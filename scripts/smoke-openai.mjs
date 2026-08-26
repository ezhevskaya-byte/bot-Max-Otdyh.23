/**
 * Ручной smoke-test прямого OpenAI API (минимальный расход токенов).
 *
 * Запуск после добавления OPENAI_API_KEY в .env:
 *   npm run smoke:openai
 *
 * Или явно:
 *   node --env-file=.env scripts/smoke-openai.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { complete, AiProviderError, resolveAiConfig } from '../backend/src/core/ai/provider.js';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf-8');

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const envPath = resolve(process.cwd(), '.env');
  loadEnvFile(envPath);

  process.env.AI_PROVIDER = 'openai';

  const openAiKey = process.env.OPENAI_API_KEY?.trim() || '';

  console.log('=== OpenAI smoke test ===');
  console.log('AI_PROVIDER:   openai');
  console.log('OPENAI_API_KEY:', openAiKey ? `задан (${openAiKey.length} симв.)` : '(не задан)');

  if (!openAiKey) {
    console.error('\nFAIL: OPENAI_API_KEY не задан.');
    console.error('Добавьте OPENAI_API_KEY в .env и повторите: npm run smoke:openai');
    console.error('Скрипт намеренно не использует legacy AI_API_KEY / OpenRouter fallback.');
    process.exit(1);
  }

  const config = resolveAiConfig();
  console.log('API base URL:  ', config.apiBaseUrl);
  console.log('Model:         ', config.model);

  try {
    const answer = await complete({
      system: 'Ответь одним словом.',
      messages: [{ role: 'user', content: 'Скажи «ок».' }],
      temperature: 0
    });

    console.log('\nSUCCESS');
    console.log('Ответ модели:', answer);
    process.exit(0);
  } catch (err) {
    console.error('\nFAIL');

    if (err instanceof AiProviderError) {
      console.error('Provider:  ', err.provider);
      console.error('Error type:', err.errorType);
      console.error('HTTP status:', err.status || '(нет)');
      console.error('Message:   ', err.message);
      process.exit(1);
    }

    console.error('Message:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
