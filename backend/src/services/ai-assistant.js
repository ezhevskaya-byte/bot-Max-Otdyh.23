import { ai } from '../../../config/index.js';
import { buildSystemPrompt } from './prompt-loader.js';
import { logger } from '../utils/logger.js';

/**
 * Обёртка для AI-ответов (опционально, для свободного диалога).
 * Основной сценарий бронирования — dialog-handler (детерминированный FSM).
 */
export async function askAi(userMessage, context = {}) {
  if (!ai.apiKey) {
    logger.warn('AI_API_KEY не задан — AI-режим отключён');
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  const body = {
    model: ai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({ message: userMessage, context }),
      },
    ],
    temperature: 0.4,
  };

  const res = await fetch(`${ai.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    logger.error('AI request failed', { status: res.status });
    return null;
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? null;
}
