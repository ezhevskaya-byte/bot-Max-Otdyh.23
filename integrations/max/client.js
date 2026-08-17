import { max, admin } from '../../config/index.js';
import { logger } from '../../backend/src/utils/logger.js';

/**
 * Клиент MAX Bot API (platform-api.max.ru).
 * @see https://dev.max.ru/docs-api/methods/POST/messages
 */
export class MaxClient {
  constructor(options = {}) {
    this.token = options.token ?? max.botToken;
    this.baseUrl = (options.baseUrl ?? max.apiBaseUrl).replace(/\/$/, '');
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: this.token,
      Accept: 'application/json',
    };

    let payload;
    if (body != null) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      payload = JSON.stringify(body);
    }

    logger.debug('MAX API request', { method, path });

    const res = await fetch(url, {
      method,
      headers,
      body: payload,
    });

    const raw = await res.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }

    if (!res.ok) {
      logger.error('MAX API error', { method, path, status: res.status, data });
      throw new Error(`MAX API ${res.status}: ${raw || res.statusText}`);
    }

    return data;
  }

  /**
   * @param {{ chatId?: number|string, userId?: number|string, text: string, buttons?: string[] }} params
   */
  async sendMessage({ chatId, userId, text, buttons = [] }) {
    const query = new URLSearchParams();
    if (chatId != null && chatId !== '') {
      query.set('chat_id', String(chatId));
    } else if (userId != null && userId !== '') {
      query.set('user_id', String(userId));
    } else {
      throw new Error('sendMessage requires chatId or userId');
    }

    const body = { text, notify: true };
    const keyboard = buildInlineKeyboard(buttons);
    if (keyboard) {
      body.attachments = [keyboard];
    }

    const path = `/messages?${query.toString()}`;
    return this.request('POST', path, body);
  }

  async sendMessageWithButtons(destination, reply) {
    return this.sendMessage({
      ...destination,
      text: reply.text,
      buttons: reply.buttons ?? [],
    });
  }

  async answerCallback(callbackQueryId, { text, showAlert = false } = {}) {
    const query = new URLSearchParams({ callback_query_id: String(callbackQueryId) });
    return this.request('POST', `/answers?${query.toString()}`, {
      text,
      show_alert: showAlert,
    });
  }
}

function buildInlineKeyboard(buttons = []) {
  if (!buttons.length) return null;

  return {
    type: 'inline_keyboard',
    payload: {
      buttons: buttons.map((label) => [
        {
          type: 'callback',
          text: label,
          payload: JSON.stringify(mapButtonPayload(label)),
        },
      ]),
    },
  };
}

function mapButtonPayload(label) {
  const map = {
    'Связаться с администратором': { action: 'contact_admin' },
    'Подтвердить заявку': { action: 'contact_admin' },
    'Изменить данные': { action: 'edit' },
    'Забронировать номер': { action: 'start_booking' },
  };
  if (label.startsWith('Вариант ')) {
    const n = label.replace('Вариант ', '');
    return { action: 'select_room', index: parseInt(n, 10) - 1 };
  }
  return map[label] ?? { action: label };
}

const defaultClient = new MaxClient();

export async function sendToAdmin(application) {
  if (!admin.maxUserId) {
    logger.warn('ADMIN_MAX_USER_ID не задан — заявка только в лог', {
      applicationId: application.id,
    });
    logger.info('Application (admin)', { text: application.adminText });
    return { ok: true, simulated: true };
  }

  return defaultClient.sendMessage({
    userId: admin.maxUserId,
    text: application.adminText,
  });
}

export { defaultClient as maxClient };
