/**
 * Универсальный HTTP-клиент к LLM API (OpenAI-compatible /chat/completions).
 * Не знает про MAX, chatId, базу знаний и историю диалога.
 */

import { logger } from '../../utils/logger.js';
import { resolveAiConfig } from './config.js';

export { resolveAiConfig } from './config.js';

export class AiProviderError extends Error {
  constructor(message, {
    status = 0,
    body = null,
    provider = 'unknown',
    errorType = 'unknown'
  } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
    this.body = body;
    this.provider = provider;
    this.errorType = errorType;
  }
}

function classifyHttpError(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'provider_error';
  return 'http_error';
}

function buildMessages({ system, messages = [] }) {
  const payload = [];

  if (system) {
    payload.push({ role: 'system', content: system });
  }

  payload.push(...messages);
  return payload;
}

function logProviderError({ provider, status, errorType, detail }) {
  logger.error('AI provider request failed', {
    provider,
    status,
    errorType,
    detail
  });
}

/**
 * @param {{ system?: string, messages?: Array<{role: string, content: string}>, temperature?: number }} input
 * @returns {Promise<string>} текст ответа модели
 * @throws {AiProviderError} при HTTP-ошибке провайдера
 */
export async function complete({ system, messages = [], temperature } = {}) {
  const { provider, apiKey, apiBaseUrl, model, keyEnv } = resolveAiConfig();

  if (!apiKey) {
    throw new AiProviderError(`${keyEnv} is not set`, {
      provider,
      errorType: 'config'
    });
  }

  const url = `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`;

  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: buildMessages({ system, messages }),
        temperature
      })
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed';

    logProviderError({
      provider,
      status: 0,
      errorType: 'network',
      detail: message
    });

    throw new AiProviderError('AI provider network error', {
      provider,
      errorType: 'network'
    });
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorType = classifyHttpError(response.status);

    logProviderError({
      provider,
      status: response.status,
      errorType,
      detail: `HTTP ${response.status}`
    });

    throw new AiProviderError(`AI provider request failed with HTTP ${response.status}`, {
      status: response.status,
      body: data,
      provider,
      errorType
    });
  }

  return data?.choices?.[0]?.message?.content?.trim() || '';
}
