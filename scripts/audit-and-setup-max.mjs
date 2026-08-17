/**
 * Полный аудит MAX-бота: токен, подписки, порт, tunnel, локальный webhook.
 * node --env-file=.env scripts/audit-and-setup-max.mjs [tunnel-webhook-url]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
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

const EXPECTED_USERNAME = (process.env.MAX_EXPECTED_USERNAME || 'id010505811832_bot').replace(/^@/, '').toLowerCase();
const token = process.env.MAX_BOT_TOKEN?.trim() || '';
const baseUrl = (process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru').replace(/\/$/, '');
const port = Number(process.env.PORT) || 3000;
const tunnelUrl = process.argv[2]?.trim();

function mask(t) {
  if (!t) return '(пусто)';
  return `${t.slice(0, 4)}…${t.slice(-4)} (${t.length})`;
}

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
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, data };
}

function checkPort() {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const pids = [...new Set(
        out.split('\n')
          .filter((l) => l.includes('LISTENING'))
          .map((l) => l.trim().split(/\s+/).pop())
          .filter(Boolean),
      )];
      return pids;
    }
    execSync(`lsof -i :${port} -t`, { encoding: 'utf-8' });
    return ['unknown'];
  } catch {
    return [];
  }
}

const report = {
  token_mask: mask(token),
  api_base: baseUrl,
  port,
  bot: null,
  token_valid: false,
  subscriptions: [],
  tunnel_url: tunnelUrl || null,
  issues: [],
  fixes: [],
};

console.log('=== MAX audit ===\n');

if (!token) {
  report.issues.push('MAX_BOT_TOKEN пуст в .env');
} else {
  const me = await api('GET', '/me');
  if (!me.ok) {
    report.issues.push(`Токен отклонён MAX API: HTTP ${me.status} ${me.data?.message || me.data?.code || ''}`);
    report.issues.push('Получите новый токен: business.max.ru → Чат-боты → Помощник Отдых.23 → Интеграция → Получить токен');
  } else {
    report.token_valid = true;
    report.bot = {
      user_id: me.data.user_id,
      username: me.data.username,
      name: me.data.first_name,
      is_bot: me.data.is_bot,
    };
    if ((me.data.username || '').toLowerCase() !== EXPECTED_USERNAME) {
      report.issues.push(`Токен от другого бота: @${me.data.username}, ожидался @${EXPECTED_USERNAME}`);
    }
    const subs = await api('GET', '/subscriptions');
    if (subs.ok) {
      report.subscriptions = subs.data?.subscriptions ?? [];
    }
  }
}

const pids = checkPort();
report.port_listeners = pids;
if (pids.length > 1) {
  report.issues.push(`На порту ${port} несколько процессов: ${pids.join(', ')} — возможен EADDRINUSE`);
}

if (tunnelUrl) {
  if (!report.token_valid) {
    report.issues.push('Webhook не перерегистрирован: токен невалиден');
  } else {
    for (const sub of report.subscriptions) {
      const url = sub.url;
      if (url && url !== tunnelUrl) {
        await api('DELETE', `/subscriptions?url=${encodeURIComponent(url)}`);
        report.fixes.push(`Удалена подписка: ${url}`);
      }
    }
    const reg = await api('POST', '/subscriptions', {
      url: tunnelUrl,
      update_types: ['message_created', 'message_callback', 'bot_started'],
      ...(process.env.MAX_WEBHOOK_SECRET ? { secret: process.env.MAX_WEBHOOK_SECRET } : {}),
    });
    if (reg.ok) {
      report.fixes.push(`Зарегистрирован webhook: ${tunnelUrl}`);
      const subs2 = await api('GET', '/subscriptions');
      report.subscriptions = subs2.data?.subscriptions ?? [];
    } else {
      report.issues.push(`POST /subscriptions failed: ${reg.status}`);
    }
  }
}

if (report.token_valid) {
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    report.local_health = health.ok ? await health.json() : { status: health.status };
  } catch {
    report.issues.push(`Backend не отвечает на :${port} — запустите npm start`);
  }
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.token_valid && report.issues.length === 0 ? 0 : 1);
