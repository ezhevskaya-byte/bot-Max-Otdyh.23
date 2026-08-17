/**
 * Локальный self-test webhook MAX (message_created).
 * Запуск: node scripts/test-max-webhook.mjs [port]
 */
const port = Number(process.argv[2]) || Number(process.env.PORT) || 3000;

const samplePayload = {
  update_type: 'message_created',
  timestamp: Date.now(),
  message: {
    sender: {
      user_id: 900001,
      name: 'Тестовый гость',
      is_bot: false,
    },
    recipient: {
      chat_id: 123456789,
      chat_type: 'dialog',
    },
    timestamp: Date.now(),
    body: {
      text: 'Привет',
    },
  },
};

async function main() {
  const url = `http://127.0.0.1:${port}/webhook/max`;
  console.log('[test] POST', url);
  console.log('[test] body:', JSON.stringify(samplePayload, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(samplePayload),
  });

  const text = await res.text();
  console.log('[test] status:', res.status);
  console.log('[test] response:', text);

  if (!res.ok) {
    process.exit(1);
  }

  const data = JSON.parse(text);
  if (!data.ok || !data.reply?.text) {
    console.error('[test] FAIL: expected ok:true and reply.text');
    process.exit(1);
  }

  console.log('[test] OK — dialog reply generated');
  if (data.sent) {
    console.log('[test] OK — reply sent to MAX API');
  } else {
    console.log('[test] WARN — reply not sent:', data.reason ?? data.error ?? 'unknown');
  }
}

main().catch((err) => {
  console.error('[test] ERROR', err.message);
  process.exit(1);
});
