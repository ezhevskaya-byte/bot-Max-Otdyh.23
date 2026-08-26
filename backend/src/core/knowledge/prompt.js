import { buildRoomSelectionHint } from '../../room-sales-logic.js';
import {
  formatGuestProfileForLlm,
  getGuestRecord,
  rememberRetrieval,
  resolveGuestProfile
} from '../guest-context/index.js';
import { retrieveKnowledge } from './retriever.js';
import { SALES_CORE, SYSTEM_CORE } from './system-core.js';

export { SYSTEM_CORE, SALES_CORE };

/** Последние реплики в LLM. Состав гостя передаётся отдельным профилем. */
export const LLM_HISTORY_WINDOW = 6;

export function selectLlmHistory(history = [], windowSize = LLM_HISTORY_WINDOW) {
  const list = Array.isArray(history) ? history : [];
  if (list.length <= windowSize) return [...list];
  return list.slice(-windowSize);
}

export function buildLlmSystemPrompt({
  knowledgeContext = '',
  roomSelectionHint = '',
  guestProfileText = ''
} = {}) {
  const hint = String(roomSelectionHint || '').trim();
  const profile = String(guestProfileText || '').trim();

  return `${SYSTEM_CORE}

${SALES_CORE}

${profile}

КОНТЕКСТ ЗНАНИЙ
Используй только факты из этого блока. Если факта нет — не выдумывай.

${String(knowledgeContext || '').trim()}

${hint ? `ДОПОЛНИТЕЛЬНАЯ ЖЁСТКАЯ ЛОГИКА ПОДБОРА:\n\n${hint}` : ''}
`.trim();
}

export function measurePromptUsage({
  topics = [],
  roomSections = [],
  fallback = false,
  knowledgeContext = '',
  system = '',
  messages = [],
  guestProfileText = ''
} = {}) {
  const knowledgeChars = String(knowledgeContext || '').length;
  const systemChars = String(system || '').length;
  const guestProfileChars = String(guestProfileText || '').length;
  const historyChars = (messages || []).reduce(
    (sum, message) => sum + String(message?.content || '').length,
    0
  );

  return {
    topics: [...topics],
    roomSections: [...roomSections],
    fallback: Boolean(fallback),
    knowledgeChars,
    systemChars,
    guestProfileChars,
    historyChars,
    totalApproxChars: systemChars + historyChars
  };
}

/**
 * Готовит LLM-запрос без вызова provider и без секретов.
 * channel + guestId — произвольные строки; core не знает MAX API.
 */
export function prepareAiFallbackCall({
  text,
  history = [],
  previousTopics,
  previousRoomSections,
  lastAssistantText = '',
  channel,
  guestId
} = {}) {
  const guestProfile = resolveGuestProfile({
    channel,
    guestId,
    text,
    history
  });

  const stored = getGuestRecord(channel, guestId);
  const topicsFromStore = stored.previousTopics || [];
  const roomsFromStore = stored.previousRoomSections || [];

  const retrieved = retrieveKnowledge({
    text,
    conversationContext: {
      messages: history,
      previousTopics:
        Array.isArray(previousTopics) && previousTopics.length
          ? previousTopics
          : topicsFromStore,
      previousRoomSections:
        Array.isArray(previousRoomSections) && previousRoomSections.length
          ? previousRoomSections
          : roomsFromStore,
      lastAssistantText,
      guestProfile
    }
  });

  rememberRetrieval({
    channel,
    guestId,
    topics: retrieved.topics,
    roomSections: retrieved.roomSections
  });

  const guestProfileText = formatGuestProfileForLlm(guestProfile);
  const roomSelectionHint = buildRoomSelectionHint(text, history, guestProfile);
  const system = buildLlmSystemPrompt({
    knowledgeContext: retrieved.context,
    roomSelectionHint,
    guestProfileText
  });
  const llmHistory = selectLlmHistory(history);
  const messages = [...llmHistory, { role: 'user', content: text }];
  const diagnostics = measurePromptUsage({
    topics: retrieved.topics,
    roomSections: retrieved.roomSections,
    fallback: retrieved.fallback,
    knowledgeContext: retrieved.context,
    system,
    messages,
    guestProfileText
  });

  return {
    retrieved,
    guestProfile,
    system,
    messages,
    diagnostics
  };
}
