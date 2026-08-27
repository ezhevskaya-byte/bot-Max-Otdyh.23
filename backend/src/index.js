import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './utils/logger.js';
import { complete, AiProviderError, resolveAiConfig } from './core/ai/provider.js';
import { routeThenMaybeAskAI } from './core/router.js';
import { rememberGuestMessage } from './core/guest-context/index.js';
import { handleHealth } from './routes/health.js';
import {
  prepareAiFallbackCall,
  getLegacyContextSizes,
  SYSTEM_CORE,
  SALES_CORE
} from './core/knowledge/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_ROOT = join(__dirname, '..');
const PROJECT_ROOT = join(BACKEND_ROOT, '..');

const API_BASE = process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru';
const token = process.env.MAX_BOT_TOKEN;


const PHOTO_BASE_URL = process.env.PHOTO_BASE_URL || '';
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

if (!token) {
  console.error('MAX_BOT_TOKEN missing');
  process.exit(1);
}

let offset = 0;
let shuttingDown = false;

const app = express();
app.get('/health', handleHealth);

const httpServer = app.listen(PORT, HOST, () => {
  logger.info('HTTP server started', { port: PORT, host: HOST });
});

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  logger.info('Shutdown signal received', { signal });

  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const conversations = new Map();
const MAX_HISTORY_MESSAGES = 12;
const CHANNEL = 'max';

function getConversation(chatId) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, []);
  }

  return conversations.get(chatId);
}

function addMessageToConversation(chatId, role, content) {
  const history = getConversation(chatId);
  history.push({ role, content });

  if (history.length > MAX_HISTORY_MESSAGES) {
    history.shift();
  }
}

async function sendMessage(chatId, text) {
  const response = await fetch(`${API_BASE}/messages?chat_id=${encodeURIComponent(chatId)}`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const data = await response.text();

  logger.info('sendMessage response', {
    status: response.status,
    body: data
  });
}

function getLastAssistantMessage(chatId) {
  const history = getConversation(chatId);

  return [...history]
    .reverse()
    .find((message) => message.role === 'assistant')?.content || '';
}

function buildPublicPhotoUrl(photoPath) {
  const normalized = photoPath.replace(/\\/g, '/');
  const marker = '/backend/rooms/';
  const relativePath = normalized.includes(marker)
    ? normalized.split(marker)[1]
    : null;

  if (!relativePath) return null;

  return `${PHOTO_BASE_URL.replace(/\/$/, '')}/rooms/${relativePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function askAI(chatId, userText) {
  const aiConfig = resolveAiConfig();

  if (!aiConfig.apiKey) {
    return `AI пока не подключён: не задан ${aiConfig.keyEnv} в .env`;
  }

  const history = getConversation(chatId);
  const prepared = prepareAiFallbackCall({
    text: userText,
    history,
    lastAssistantText: getLastAssistantMessage(chatId),
    channel: CHANNEL,
    guestId: String(chatId)
  });
  logger.info('AI fallback context', prepared.diagnostics);

  try {
    const answer = await complete({
      system: prepared.system,
      messages: prepared.messages,
      temperature: 0.15
    });

    return answer || 'Не смогла сформировать ответ.';
  } catch (err) {
    if (err instanceof AiProviderError) {
      return 'Извините, сейчас не получилось получить ответ. Попробуйте ещё раз чуть позже.';
    }

    throw err;
  }
}

async function processUpdate(update) {
  try {
    console.log('[MAX UPDATE]', JSON.stringify(update));

    const message = update.message;
    if (!message) return;

    const chatId = message.recipient?.chat_id || message.chat?.chat_id || message.chat_id;
    const text = message.body?.text || message.text || '';

    if (!chatId) {
      console.log('[MAX] chatId not found', JSON.stringify(message));
      return;
    }

    if (!text.trim()) {
      await sendMessage(chatId, 'Напишите, пожалуйста, ваш вопрос текстом.');
      return;
    }

    rememberGuestMessage({
      channel: CHANNEL,
      guestId: String(chatId),
      text
    });

    const result = await routeThenMaybeAskAI({
      text,
      context: {
        lastAssistantText: getLastAssistantMessage(chatId)
      },
      askAI: (userText) => askAI(chatId, userText)
    });

    if (result.type === 'room-link') {
      await sendMessage(chatId, result.text);
      return;
    }

    addMessageToConversation(chatId, 'user', text);
    addMessageToConversation(chatId, 'assistant', result.text);

    await sendMessage(chatId, result.text);
  } catch (err) {
    console.error('processUpdate error', err);
  }
}

async function poll() {
  while (!shuttingDown) {
    try {
      const response = await fetch(`${API_BASE}/updates?limit=20&offset=${offset}`, {
        headers: {
          Authorization: token,
          Accept: 'application/json'
        }
      });

      const data = await response.json();
      console.log('[MAX POLL]', response.status, JSON.stringify(data));

      if (Array.isArray(data.updates)) {
        for (const update of data.updates) {
          offset = Number(update.update_id ?? update.timestamp ?? offset) + 1;
          await processUpdate(update);
        }
      }
    } catch (err) {
      console.error('poll error', err);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

const legacySizes = getLegacyContextSizes();

logger.info('MAX bot polling started');
logger.info('Knowledge loaded', {
  backendRoot: BACKEND_ROOT,
  projectRoot: PROJECT_ROOT,
  roomsChars: legacySizes.roomsChars,
  propertyChars: legacySizes.propertyChars,
  policiesChars: legacySizes.policiesChars,
  promptsChars: legacySizes.promptsChars,
  systemCoreChars: SYSTEM_CORE.length,
  salesCoreChars: SALES_CORE.length,
  photoBaseUrl: PHOTO_BASE_URL || 'not set'
});

poll();