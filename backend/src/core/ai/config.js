/**
 * Резолвинг AI-провайдера и env-переменных.
 * Единый источник конфигурации для provider.js и config/index.js.
 */

export const AI_PROVIDERS = {
  OPENAI: 'openai',
  OPENROUTER: 'openrouter'
};

const PROVIDER_DEFAULTS = {
  [AI_PROVIDERS.OPENAI]: {
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY',
    baseEnv: 'OPENAI_API_BASE_URL',
    modelEnv: 'OPENAI_MODEL'
  },
  [AI_PROVIDERS.OPENROUTER]: {
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    keyEnv: 'OPENROUTER_API_KEY',
    baseEnv: 'OPENROUTER_API_BASE_URL',
    modelEnv: 'OPENROUTER_MODEL'
  }
};

const LEGACY_DEFAULTS = {
  apiBaseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini'
};

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeProviderName(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === AI_PROVIDERS.OPENAI || normalized === AI_PROVIDERS.OPENROUTER) {
    return normalized;
  }

  return '';
}

/**
 * @returns {{
 *   provider: 'openai' | 'openrouter' | 'legacy',
 *   apiKey: string,
 *   apiBaseUrl: string,
 *   model: string,
 *   keyEnv: string
 * }}
 */
export function resolveAiConfig() {
  const provider = normalizeProviderName(process.env.AI_PROVIDER);

  if (provider) {
    const defaults = PROVIDER_DEFAULTS[provider];

    return {
      provider,
      apiKey: firstNonEmpty(process.env[defaults.keyEnv], process.env.AI_API_KEY),
      apiBaseUrl: firstNonEmpty(process.env[defaults.baseEnv], process.env.AI_API_BASE_URL, defaults.apiBaseUrl),
      model: firstNonEmpty(process.env[defaults.modelEnv], process.env.AI_MODEL, defaults.model),
      keyEnv: defaults.keyEnv
    };
  }

  return {
    provider: 'legacy',
    apiKey: firstNonEmpty(process.env.AI_API_KEY),
    apiBaseUrl: firstNonEmpty(process.env.AI_API_BASE_URL, LEGACY_DEFAULTS.apiBaseUrl),
    model: firstNonEmpty(process.env.AI_MODEL, LEGACY_DEFAULTS.model),
    keyEnv: 'AI_API_KEY'
  };
}
