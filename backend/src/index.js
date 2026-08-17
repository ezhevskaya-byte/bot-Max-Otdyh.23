import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './utils/logger.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { buildRoomSelectionHint } from './room-sales-logic.js';
import {
  isPhotoRequest,
  detectRequestedRoom,
  getRoomPhotoLink,
  getWebsiteRoomLink
} from './photo-service.js';
import { formatRoomLinkMessage } from './room-links.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_ROOT = join(__dirname, '..');
const PROJECT_ROOT = join(BACKEND_ROOT, '..');

const API_BASE = process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru';
const token = process.env.MAX_BOT_TOKEN;

const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_BASE_URL = process.env.AI_API_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const PHOTO_BASE_URL = process.env.PHOTO_BASE_URL || '';

if (!token) {
  console.error('MAX_BOT_TOKEN missing');
  process.exit(1);
}

let offset = 0;

const conversations = new Map();
const MAX_HISTORY_MESSAGES = 12;

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

function readTextFileSafe(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function loadRoomsKnowledge() {
  const roomsRoot = join(BACKEND_ROOT, 'rooms');

  if (!existsSync(roomsRoot)) {
    return 'База комнат пока не подключена.';
  }

  const roomFolders = readdirSync(roomsRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  const parts = [];

  for (const folder of roomFolders) {
    const folderPath = join(roomsRoot, folder);

    parts.push(`
КОМНАТА: ${folder}

ROOM.JSON:
${readTextFileSafe(join(folderPath, 'room.json'))}

DESCRIPTION:
${readTextFileSafe(join(folderPath, 'description.txt'))}

SCENARIOS:
${readTextFileSafe(join(folderPath, 'scenarios.txt'))}
`);
  }

  return parts.join('\n\n-----------------------------\n\n');
}

function loadPropertyKnowledge() {
  const propertyRoot = join(BACKEND_ROOT, 'property');

  if (!existsSync(propertyRoot)) {
    return 'База территории пока не подключена.';
  }

  const folders = readdirSync(propertyRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  const parts = [];

  for (const folder of folders) {
    const folderPath = join(propertyRoot, folder);

    parts.push(`
ОБЪЕКТ: ${folder}

DESCRIPTION:
${readTextFileSafe(join(folderPath, 'description.txt'))}

SCENARIOS:
${readTextFileSafe(join(folderPath, 'scenarios.txt'))}
`);
  }

  return parts.join('\n\n-----------------------------\n\n');
}

function loadPoliciesKnowledge() {
  const policiesRoot = join(BACKEND_ROOT, 'policies');

  if (!existsSync(policiesRoot)) {
    return 'База правил пока не подключена.';
  }

  return readdirSync(policiesRoot)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map((file) => `
POLICY FILE: ${file}

${readTextFileSafe(join(policiesRoot, file))}
`)
    .join('\n\n-----------------------------\n\n');
}

function loadTextFilesFromFolder(folderPath, label) {
  if (!existsSync(folderPath)) return [];

  return readdirSync(folderPath)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map((file) => {
      const filePath = join(folderPath, file);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) return '';
      const content = readTextFileSafe(filePath);
      if (!content.trim()) return '';

      return `
${label}: ${file}
PATH: ${filePath}

${content}
`;
    })
    .filter(Boolean);
}

function loadPromptsKnowledge() {
  const parts = [
    ...loadTextFilesFromFolder(join(BACKEND_ROOT, 'prompts'), 'PROMPT FILE'),
    ...loadTextFilesFromFolder(join(PROJECT_ROOT, 'prompts'), 'PROMPT FILE')
  ];

  return parts.length
    ? parts.join('\n\n-----------------------------\n\n')
    : 'Дополнительные sales prompt пока не подключены.';
}

const ROOMS_KNOWLEDGE = loadRoomsKnowledge();
const PROPERTY_KNOWLEDGE = loadPropertyKnowledge();
const POLICIES_KNOWLEDGE = loadPoliciesKnowledge();
const PROMPTS_KNOWLEDGE = loadPromptsKnowledge();

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

async function trySendRoomPhotos(chatId, userText) {
  const lastAssistantMessage = getLastAssistantMessage(chatId);
  const roomKey = detectRequestedRoom(userText, lastAssistantMessage);
  const websiteLink = getWebsiteRoomLink(roomKey, userText, lastAssistantMessage);

  logger.info('Photo request detected', {
    roomKey,
    websiteLink
  });

  if (websiteLink) {
    await sendMessage(chatId, formatRoomLinkMessage(websiteLink));
    return true;
  }

  if (!roomKey) {
    await sendMessage(
      chatId,
      'Конечно, покажу фото. Уточните, пожалуйста, какую категорию номера хотите посмотреть: Комфорт, Делюкс 2 этаж, Делюкс 3 этаж или Семейный?'
    );
    return true;
  }

  const roomInfo = getRoomPhotoLink(roomKey, userText, lastAssistantMessage);

  if (!roomInfo) {
    await sendMessage(
      chatId,
      'Конечно, покажу фото. Уточните, пожалуйста, какую категорию номера хотите посмотреть: Комфорт, Делюкс 2 этаж, Делюкс 3 этаж или Семейный?'
    );
    return true;
  }

  const message = [
    `📸 Фотографии категории «${roomInfo.title}»:`,
    '',
    roomInfo.url
  ].join('\n');

  await sendMessage(chatId, message);

  return true;
}

async function askAI(chatId, userText) {
  if (!AI_API_KEY) {
    return 'AI пока не подключён: не задан AI_API_KEY в .env';
  }

  const history = getConversation(chatId);
  const roomSelectionHint = buildRoomSelectionHint(userText, history);

  const fullSystemPrompt = `${SYSTEM_PROMPT}

ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ПРОДАЖ И ПЕРЕГОВОРОВ:

${PROMPTS_KNOWLEDGE}

БАЗА КОМНАТ ГОСТЕВОГО ДОМА:

${ROOMS_KNOWLEDGE}

БАЗА ТЕРРИТОРИИ И ОБЩИХ ЗОН:

${PROPERTY_KNOWLEDGE}

ПРАВИЛА, ПОЛИТИКИ И СТИЛЬ ОБЩЕНИЯ:

${POLICIES_KNOWLEDGE}

ВАЖНО:
1. Используй базу комнат как главный источник информации о категориях, размещении, сценариях, ограничениях и описаниях.
2. Используй sales-rules как главный источник логики продаж и ведения гостя к бронированию.
3. Для состава 2 взрослых + 1 ребёнок сначала предлагай «Комфорт», а «Семейную» только как более просторную альтернативу.
4. Если гость прямо просит вариант поменьше, компактнее, дешевле или спрашивает почему не «Комфорт» — обязательно подробно расскажи про «Комфорт» и не настаивай на «Семейной».
5. Не придумывай цены и свободные даты.
6. Если нужно подтвердить наличие мест, стоимость или бронирование — переводи к администратору Оксане.
7. Не пиши гостю технические ограничения: «не могу отправить фото», «автоматическая отправка невозможна» и подобные фразы.
8. Помни контекст диалога: последнюю предложенную комнату, состав гостей, даты и пожелания.

ДОПОЛНИТЕЛЬНАЯ ЖЁСТКАЯ ЛОГИКА ПОДБОРА:

${roomSelectionHint}
`;

  const response = await fetch(`${AI_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: fullSystemPrompt
        },
        ...history,
        {
          role: 'user',
          content: userText
        }
      ],
      temperature: 0.15
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('AI error', data);
    return 'Извините, сейчас не получилось получить ответ. Попробуйте ещё раз чуть позже.';
  }

  return data.choices?.[0]?.message?.content?.trim() || 'Не смогла сформировать ответ.';
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

    if (isPhotoRequest(text)) {
      const photoSent = await trySendRoomPhotos(chatId, text);
    
      if (photoSent) {
        return;
      }
    }
    
    const answer = await askAI(chatId, text);
    
    addMessageToConversation(chatId, 'user', text);
    addMessageToConversation(chatId, 'assistant', answer);
    
    await sendMessage(chatId, answer);
  } catch (err) {
    console.error('processUpdate error', err);
  }
}

async function poll() {
  while (true) {
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

logger.info('MAX bot polling started');
logger.info('Knowledge loaded', {
  backendRoot: BACKEND_ROOT,
  projectRoot: PROJECT_ROOT,
  roomsChars: ROOMS_KNOWLEDGE.length,
  propertyChars: PROPERTY_KNOWLEDGE.length,
  policiesChars: POLICIES_KNOWLEDGE.length,
  promptsChars: PROMPTS_KNOWLEDGE.length,
  photoBaseUrl: PHOTO_BASE_URL || 'not set'
});

poll();