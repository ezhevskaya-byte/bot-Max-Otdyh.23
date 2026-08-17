import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMaxUpdate } from '../../integrations/max/webhook.js';

describe('parseMaxUpdate', () => {
  it('парсит message_created из реального payload MAX', () => {
    const parsed = parseMaxUpdate({
      update_type: 'message_created',
      message: {
        sender: { user_id: 42, name: 'Иван' },
        recipient: { chat_id: 999 },
        body: { text: 'Привет' },
      },
    });

    assert.equal(parsed.updateType, 'message_created');
    assert.equal(parsed.userId, '42');
    assert.equal(parsed.chatId, 999);
    assert.equal(parsed.text, 'Привет');
    assert.equal(parsed.guestName, 'Иван');
    assert.equal(parsed.skipped, false);
  });

  it('парсит message_callback payload', () => {
    const parsed = parseMaxUpdate({
      update_type: 'message_callback',
      callback: {
        callback_id: 'cb-1',
        user: { user_id: 7, name: 'Гость' },
        payload: '{"action":"start_booking"}',
        message: { recipient: { chat_id: 555 } },
      },
    });

    assert.equal(parsed.userId, '7');
    assert.equal(parsed.chatId, 555);
    assert.deepEqual(parsed.payload, { action: 'start_booking' });
    assert.equal(parsed.callbackId, 'cb-1');
  });
});
