/**
 * Проверка токена MAX: бот (/me) и webhook-подписки (/subscriptions).
 *
 * Запуск:
 *   node --env-file=.env scripts/check-max-bot.mjs
 *   node --env-file=.env scripts/check-max-bot.mjs id010505811832_bot
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_USERNAME = (process.argv[2] || process.env.MAX_EXPECTED_USERNAME || 'id010505811832_bot')
  .replace(/^@/, '')
  .toLowerCase();

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

const envPath = resolve(process.cwd(), '.env');
loadEnvFile(envPath);

const token = process.env.MAX_BOT_TOKEN?.trim() || '';
const baseUrl = (process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru').replace(/\/$/, '');
const webhookSecret = process.env.MAX_WEBHOOK_SECRET?.trim() || '';

function maskToken(t) {
  if (!t) return '(не задан)';
  if (t.length <= 8) return '***';
  return `${t.slice(0, 4)}…${t.slice(-4)} (${t.length} симв.)`;
}

async function maxGet(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, url };
}

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

function diagnoseSubscriptions(subscriptions) {
  const issues = [];
  const tips = [];

  if (!subscriptions?.length) {
    issues.push('Нет активных webhook-подписок — MAX не будет слать события.');
    tips.push('Создайте подписку: POST /subscriptions с url (HTTPS :443) и update_types.');
    return { issues, tips };
  }

  for (const sub of subscriptions) {
    const url = sub.url ?? sub.webhook_url ?? '(нет url)';
    const types = sub.update_types ?? sub.updateTypes;

    if (!String(url).startsWith('https://')) {
      issues.push(`Подписка ${url}: URL должен быть https:// (с 25.05 HTTP не поддерживается).`);
    }
    if (String(url).match(/:\d+/)) {
      issues.push(`Подписка ${url}: в URL не должно быть порта — MAX шлёт только на 443.`);
    }
    if (String(url).includes('trycloudflare.com')) {
      tips.push(
        `Подписка ${url}: trycloudflare URL меняется при каждом перезапуске cloudflared — после рестарта tunnel обновите подписку (npm run register:max-webhook).`,
      );
    }
    if (types === undefined || types === null) {
      tips.push(
        `Подписка ${url}: MAX не вернул update_types — пересоздайте подписку с явным ["message_created","message_callback","bot_started"].`,
      );
    } else if (Array.isArray(types) && types.length && !types.includes('message_created')) {
      issues.push(`Подписка ${url}: нет message_created в update_types → входящие сообщения не придут.`);
    }
    if (webhookSecret && !sub.secret) {
      tips.push('В подписке не указан secret, а MAX_WEBHOOK_SECRET задан в .env — проверка заголовка может отличаться.');
    }
  }

  if (subscriptions.length > 1) {
    tips.push('Несколько подписок — убедитесь, что tunnel указывает на тот же URL, что в MAX.');
  }

  return { issues, tips };
}

async function main() {
  printSection('Конфигурация');
  console.log('API base URL:     ', baseUrl);
  if (baseUrl.includes('api.max.ru') && !baseUrl.includes('platform-api')) {
    console.warn('⚠ Неверный API URL! Используйте https://platform-api.max.ru (api.max.ru даёт 404).');
  }
  console.log('MAX_BOT_TOKEN:    ', maskToken(token));
  console.log('MAX_WEBHOOK_SECRET:', webhookSecret ? `задан (${webhookSecret.length} симв.)` : '(не задан)');
  console.log('Ожидаемый username:', EXPECTED_USERNAME);

  if (!token) {
    console.error('\nОШИБКА: MAX_BOT_TOKEN пуст. Заполните .env токеном из MAX → Чат-боты → Интеграция.');
    process.exit(1);
  }

  printSection('GET /me — бот по токену');
  const meRes = await maxGet('/me');
  console.log('HTTP', meRes.status, meRes.url);

  if (!meRes.ok) {
    console.error('Ответ:', JSON.stringify(meRes.data, null, 2));
    console.error('\nТокен недействителен или API URL неверный. Проверьте MAX_BOT_TOKEN и MAX_API_BASE_URL.');
    process.exit(1);
  }

  const bot = meRes.data;
  const username = (bot.username || '').toLowerCase();
  const userId = bot.user_id;
  const name = bot.first_name ?? bot.name ?? '(без имени)';

  console.log('user_id:          ', userId);
  console.log('username:         ', bot.username ?? '(null)');
  console.log('first_name (имя): ', name);
  console.log('is_bot:           ', bot.is_bot);
  console.log('last_activity:    ', bot.last_activity_time
    ? new Date(bot.last_activity_time).toISOString()
    : '(нет)');

  const usernameMatch = username === EXPECTED_USERNAME;
  console.log('\nСовпадение с', EXPECTED_USERNAME + ':', usernameMatch ? 'ДА' : 'НЕТ');

  if (!usernameMatch) {
    console.warn('⚠ Токен, вероятно, от ДРУГОГО бота. Возьмите токен у бота @' + EXPECTED_USERNAME + ' в кабинете MAX.');
  }

  if (bot.is_bot === false) {
    console.warn('⚠ Токен принадлежит пользователю, не боту.');
  }

  printSection('GET /subscriptions — webhook');
  const subRes = await maxGet('/subscriptions');
  console.log('HTTP', subRes.status);

  if (!subRes.ok) {
    console.error('Ответ:', JSON.stringify(subRes.data, null, 2));
    process.exit(1);
  }

  const subscriptions = subRes.data?.subscriptions ?? subRes.data ?? [];
  const list = Array.isArray(subscriptions) ? subscriptions : [subscriptions];

  if (!list.length) {
    console.log('Подписок нет.');
  } else {
    list.forEach((sub, i) => {
      console.log(`\n--- Подписка #${i + 1} ---`);
      console.log('url:           ', sub.url ?? sub.webhook_url);
      console.log('update_types:  ', (sub.update_types ?? sub.updateTypes ?? []).join(', ') || '(все?)');
      console.log('secret в MAX:  ', sub.secret ? 'задан' : 'не задан');
    });
  }

  const { issues, tips } = diagnoseSubscriptions(list);

  printSection('Диагностика доставки webhook');
  console.log('Если npm start молчит при сообщении в MAX:');
  console.log('1. Токен должен быть от того же бота, куда пишете (@' + EXPECTED_USERNAME + ').');
  console.log('2. В MAX у пользователя бот не должен быть «остановлен» (bot_stopped в настройках).');
  console.log('3. URL подписки = HTTPS tunnel без порта, endpoint отвечает 200 за 30 сек.');
  console.log('4. В update_types обязательно есть message_created.');
  console.log('5. После 8 ч без успешного 200 MAX отписывает бота от webhook автоматически.');
  console.log('6. Long Polling при активном webhook не работает — это нормально.');

  if (issues.length) {
    console.log('\nПроблемы:');
    issues.forEach((x) => console.log('  ✗', x));
  } else {
    console.log('\nПроблем с подписками по конфигу не найдено.');
  }

  if (tips.length) {
    console.log('\nЗамечания:');
    tips.forEach((x) => console.log('  •', x));
  }

  printSection('Итог');
  console.log(JSON.stringify({
    ok: usernameMatch && issues.length === 0,
    bot: { user_id: userId, username: bot.username, name },
    expected_username: EXPECTED_USERNAME,
    username_match: usernameMatch,
    subscriptions_count: list.length,
    subscription_urls: list.map((s) => s.url ?? s.webhook_url),
    issues,
  }, null, 2));
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
