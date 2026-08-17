/**
 * Перерегистрация webhook MAX с явными update_types.
 *
 * Запуск:
 *   node --env-file=.env scripts/register-max-webhook.mjs https://ваш-tunnel.trycloudflare.com/webhook/max
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));

const webhookUrl = process.argv[2]?.trim() || process.env.MAX_WEBHOOK_URL?.trim();
const token = process.env.MAX_BOT_TOKEN?.trim() || '';
const baseUrl = (process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru').replace(/\/$/, '');
const secret = process.env.MAX_WEBHOOK_SECRET?.trim() || undefined;

const updateTypes = [
  'message_created',
  'message_callback',
  'bot_started',
];

async function api(method, path, body) {
  const opts = { method, headers: { Authorization: token, Accept: 'application/json' } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json; charset=utf-8';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  if (!token) {
    console.error('MAX_BOT_TOKEN не задан в .env');
    process.exit(1);
  }

  const me = await api('GET', '/me');
  if (!me.ok) {
    console.error('Токен недействителен (GET /me):', me.status, me.data);
    console.error('Получите токен: business.max.ru → Чат-боты → Интеграция → Получить токен');
    process.exit(1);
  }
  console.log('Бот:', me.data.username, '|', me.data.first_name, '| user_id:', me.data.user_id);
  if (!webhookUrl?.startsWith('https://')) {
    console.error('Укажите HTTPS URL: node scripts/register-max-webhook.mjs https://.../webhook/max');
    process.exit(1);
  }

  const existing = await api('GET', '/subscriptions');
  const list = existing.data?.subscriptions ?? [];
  for (const sub of list) {
    const url = sub.url ?? sub.webhook_url;
    if (url && url !== webhookUrl) {
      console.log('DELETE old:', url);
      await api('DELETE', `/subscriptions?url=${encodeURIComponent(url)}`);
    }
  }

  const body = { url: webhookUrl, update_types: updateTypes };
  if (secret) body.secret = secret;

  console.log('POST /subscriptions');
  console.log(JSON.stringify(body, null, 2));

  const reg = await api('POST', '/subscriptions', body);
  console.log('HTTP', reg.status);
  console.log(JSON.stringify(reg.data, null, 2));

  if (!reg.ok) {
    process.exit(1);
  }

  const verify = await api('GET', '/subscriptions');
  const after = verify.data?.subscriptions ?? [];
  console.log('\nПодписок после регистрации:', after.length);
  after.forEach((s, i) => console.log(`  ${i + 1}. ${s.url}`));

  console.log('\nГотово. Проверьте: npm run check:max-bot');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
