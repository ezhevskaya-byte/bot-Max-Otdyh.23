import { normalizeText } from './text-normalize.js';
import { matchRoomLink } from './room-link-route.js';
import { matchCommand } from './commands.js';
import { matchFaq } from './faq/answers.js';

function aiFallback() {
  return {
    handled: false,
    type: 'ai',
    text: '',
    data: { fallback: true }
  };
}

export function logRoute(result) {
  if (!result || !result.handled) {
    console.log('[ROUTER] ai-fallback');
    return;
  }

  if (result.type === 'faq') {
    console.log(`[ROUTER] faq:${result.data?.intent || 'unknown'}`);
    return;
  }

  if (result.type === 'room-link') {
    console.log('[ROUTER] room-link');
    return;
  }

  if (result.type === 'command') {
    console.log(`[ROUTER] command:${result.data?.intent || 'unknown'}`);
    return;
  }

  console.log('[ROUTER] ai-fallback');
}

/**
 * Детерминированный router.
 * Не знает про MAX chat_id, не вызывает LLM, не хранит историю.
 */
export function routeMessage({ text, context = {} } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return aiFallback();

  const lastAssistantText = context.lastAssistantText || '';
  const roomLink = matchRoomLink({ text: raw, lastAssistantText });
  if (roomLink) return roomLink;

  const normalized = normalizeText(raw);
  const command = matchCommand(normalized);
  if (command) return command;

  const faq = matchFaq(normalized);
  if (faq) return faq;

  return aiFallback();
}

/**
 * MAX-слой передаёт askAI как зависимость.
 * Provider вызывается только при handled=false.
 */
export async function routeThenMaybeAskAI({ text, context = {}, askAI }) {
  const routed = routeMessage({ text, context });
  logRoute(routed);

  if (routed.handled) {
    return routed;
  }

  const answer = await askAI(text);
  return {
    handled: false,
    type: 'ai',
    text: answer,
    data: { fallback: true }
  };
}
