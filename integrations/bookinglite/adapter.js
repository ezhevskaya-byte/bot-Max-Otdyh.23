import { bookingLiteClient } from './client.js';
import { matchRooms } from '../../backend/src/services/room-matcher.js';
import { logger } from '../../backend/src/utils/logger.js';

/**
 * Адаптер: подбор комнат + фильтр по доступности BookingLite.
 * Пока BookingLite выключен — возвращает только локальный matchRooms.
 */
export async function suggestAvailableRooms(bookingData) {
  const localMatches = matchRooms(bookingData);

  if (!bookingLiteClient.isEnabled()) {
    return localMatches;
  }

  try {
    const availability = await bookingLiteClient.checkAvailability({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
    });

    if (!availability) return localMatches;

    const availableIds = new Set(
      (Array.isArray(availability) ? availability : availability.items ?? [])
        .filter((item) => item.available !== false)
        .map((item) => item.roomTypeId ?? item.room_type),
    );

    const filtered = localMatches.filter((m) => availableIds.has(m.roomTypeId));

    if (!filtered.length) {
      logger.info('No rooms available in BookingLite for period', bookingData);
    }

    return filtered.length ? filtered : localMatches;
  } catch (err) {
    logger.warn('BookingLite availability failed, fallback to local', {
      error: err.message,
    });
    return localMatches;
  }
}

/**
 * После отправки заявки админу — опционально создать черновик в BookingLite.
 */
export async function syncApplicationToBookingLite(application) {
  if (!bookingLiteClient.isEnabled()) return null;
  return bookingLiteClient.createBookingDraft(application);
}
