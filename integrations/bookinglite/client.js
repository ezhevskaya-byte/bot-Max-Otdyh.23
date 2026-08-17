import { bookingLite } from '../../config/index.js';
import { logger } from '../../backend/src/utils/logger.js';

/**
 * Клиент BookingLite — заготовка для проверки доступности и синхронизации броней.
 * Включить: BOOKINGLITE_ENABLED=true и задать URL/ключ в .env
 */
export class BookingLiteClient {
  constructor(options = {}) {
    this.enabled = options.enabled ?? bookingLite.enabled;
    this.apiUrl = options.apiUrl ?? bookingLite.apiUrl;
    this.apiKey = options.apiKey ?? bookingLite.apiKey;
  }

  isEnabled() {
    return this.enabled && Boolean(this.apiUrl && this.apiKey);
  }

  async request(method, path, body) {
    if (!this.isEnabled()) {
      logger.debug('BookingLite disabled — skip request', { path });
      return null;
    }

    const url = `${this.apiUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      logger.error('BookingLite API error', { path, status: res.status });
      throw new Error(`BookingLite ${res.status}`);
    }

    return res.json();
  }

  /**
   * Проверка доступности номеров на период (реализовать по API BookingLite).
   * @returns {Promise<Array<{ roomTypeId: string, available: boolean }>|null>}
   */
  async checkAvailability({ checkIn, checkOut, roomTypeId }) {
    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      ...(roomTypeId ? { room_type: roomTypeId } : {}),
    });
    return this.request('GET', `/availability?${params}`);
  }

  /**
   * Создание черновика брони после подтверждения гостем (опционально).
   */
  async createBookingDraft(application) {
    return this.request('POST', '/bookings/draft', {
      external_id: application.id,
      guest_max_id: application.userId,
      check_in: application.data.checkIn,
      check_out: application.data.checkOut,
      adults: application.data.adults,
      children: application.data.children,
      room_type: application.data.selectedRoom?.roomTypeId,
      notes: application.data.bedPreferences,
    });
  }

  /**
   * Синхронизация статуса заявки.
   */
  async getBookingStatus(externalId) {
    return this.request('GET', `/bookings/external/${externalId}`);
  }
}

export const bookingLiteClient = new BookingLiteClient();
