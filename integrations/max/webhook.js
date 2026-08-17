import { max } from '../../config/index.js';
import { handleMessage } from '../../backend/src/services/dialog-handler.js';
import { maxClient } from './client.js';
import { logger } from '../../backend/src/utils/logger.js';

/** Подробные логи pipeline MAX (всегда в консоль). */
export function maxPipelineLog(stage, data = {}) {
  const entry = {
    time: new Date().toISOString(),
    stage,
    ...data,
  };
  console.log('[MAX]', JSON.stringify(entry, null, 0));
  logger.debug(`MAX pipeline: ${stage}`, data);
}

/**
 * Парсинг webhook MAX (message_created, message_callback, тестовый JSON).
 * @see https://dev.max.ru/docs-api/objects/Update
 */
export function parseMaxUpdate(body) {
  const updateType = body?.update_type ?? body?.type ?? null;

  // Локальный self-test: { userId, chatId, text }
  const directUserId = body?.userId ?? body?.user_id;
  if (directUserId != null && directUserId !== '') {
    return {
      updateType: updateType ?? 'test',
      userId: String(directUserId),
      chatId: body.chatId ?? body.chat_id ?? null,
      text: body.text ?? '',
      guestName: body.guestName ?? body.guest_name ?? null,
      payload: body.payload ?? null,
      callbackId: null,
      skipped: false,
    };
  }

  if (updateType === 'message_created' || (body?.message && !body?.callback)) {
    const message = body.message ?? {};
    const sender = message.sender ?? {};
    const recipient = message.recipient ?? {};
    const messageBody = message.body ?? {};

    return {
      updateType: 'message_created',
      userId: String(sender.user_id ?? sender.id ?? ''),
      chatId: recipient.chat_id ?? null,
      text: messageBody.text ?? messageBody.markdown ?? '',
      guestName: sender.name ?? sender.first_name ?? null,
      payload: null,
      callbackId: null,
      skipped: false,
    };
  }

  if (updateType === 'message_callback' || body?.callback) {
    const callback = body.callback ?? {};
    const user = callback.user ?? callback.sender ?? {};
    let payload = callback.payload ?? null;
    if (typeof payload === 'string' && payload) {
      try {
        payload = JSON.parse(payload);
      } catch {
        /* оставляем строку */
      }
    }

    const message = callback.message ?? body.message ?? {};
    const recipient = message.recipient ?? {};

    return {
      updateType: 'message_callback',
      userId: String(user.user_id ?? user.id ?? ''),
      chatId: recipient.chat_id ?? callback.chat_id ?? null,
      text: '',
      guestName: user.name ?? user.first_name ?? null,
      payload,
      callbackId: callback.callback_id ?? callback.id ?? null,
      skipped: false,
    };
  }

  return {
    updateType,
    userId: '',
    chatId: null,
    text: '',
    guestName: null,
    payload: null,
    callbackId: null,
    skipped: true,
  };
}

export function verifyWebhook(req) {
  const secret = req.headers['x-max-bot-api-secret']
    ?? req.headers['x-max-webhook-secret']
    ?? req.headers['x-webhook-secret'];
  if (!max.webhookSecret) return true;
  return secret === max.webhookSecret;
}

function resolveSendTarget({ chatId, userId }) {
  if (chatId != null && chatId !== '') {
    return { chatId: Number(chatId) || chatId };
  }
  if (userId) {
    return { userId: Number(userId) || userId };
  }
  return null;
}

export async function processWebhook(body) {
  maxPipelineLog('webhook received', {
    updateType: body?.update_type,
    hasMessage: Boolean(body?.message),
    hasCallback: Boolean(body?.callback),
  });

  const parsed = parseMaxUpdate(body);
  maxPipelineLog('parsed payload', {
    updateType: parsed.updateType,
    userId: parsed.userId,
    chatId: parsed.chatId,
    text: parsed.text,
    guestName: parsed.guestName,
    hasPayload: Boolean(parsed.payload),
    skipped: parsed.skipped,
  });

  if (parsed.skipped) {
    maxPipelineLog('update skipped', { updateType: parsed.updateType });
    return { ok: true, skipped: true, updateType: parsed.updateType };
  }

  const { userId, chatId, text, guestName, payload, callbackId } = parsed;

  if (!userId) {
    maxPipelineLog('extract failed: empty userId', { body });
    logger.warn('Webhook without userId', { updateType: parsed.updateType });
    return { ok: false, error: 'userId missing' };
  }

  maxPipelineLog('calling processMessage', { userId, chatId, textPreview: text?.slice(0, 80) });

  const reply = await handleMessage({ userId, text, guestName, payload });

  maxPipelineLog('processMessage result', {
    textPreview: reply?.text?.slice(0, 120),
    buttons: reply?.buttons,
  });

  const destination = resolveSendTarget({ chatId, userId });
  if (!destination) {
    maxPipelineLog('send skipped: no chatId/userId destination');
    return { ok: true, reply, sent: false, reason: 'no_destination' };
  }

  if (!max.botToken) {
    maxPipelineLog('send skipped: MAX_BOT_TOKEN not set');
    return { ok: true, reply, sent: false, reason: 'no_token' };
  }

  maxPipelineLog('sending reply via MAX API', destination);

  try {
    const apiResponse = await maxClient.sendMessageWithButtons(destination, reply);
    maxPipelineLog('MAX API response', { apiResponse });

    if (callbackId) {
      try {
        await maxClient.answerCallback(callbackId, { text: 'Принято' });
      } catch (err) {
        maxPipelineLog('answerCallback error', { error: err.message });
      }
    }

    return { ok: true, reply, sent: true, destination, apiResponse };
  } catch (err) {
    maxPipelineLog('send error', { error: err.message, destination });
    logger.error('MAX send failed', { userId, chatId, error: err.message });
    return { ok: true, reply, sent: false, error: err.message, destination };
  }
}
