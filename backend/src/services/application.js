import { randomUUID } from 'node:crypto';
import { admin, rooms } from '../../../config/index.js';
import { renderTemplate } from '../utils/template.js';
import { nightsBetween } from '../utils/dates.js';

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.guestName]
 * @param {object} params.data — поля сессии
 */
export function buildApplication({ userId, guestName, data }) {
  const applicationId = randomUUID();
  const nights = nightsBetween(data.checkIn, data.checkOut);
  const room = data.selectedRoom;

  const templateData = {
    applicationId,
    guestName: guestName || 'Гость',
    guestMaxId: userId,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    nights,
    adults: data.adults,
    children: data.children,
    childrenAges: Array.isArray(data.childrenAges)
      ? data.childrenAges.join(', ')
      : data.childrenAges,
    bedPreferences: data.bedPreferences,
    roomName: room?.roomName ?? '',
    roomTypeId: room?.roomTypeId ?? '',
    roomLayoutDescription: room?.layoutDescription ?? '',
    priceNotice: rooms.rules.priceMessage,
    adminName: admin.name,
    createdAt: new Date().toLocaleString('ru-RU'),
  };

  return {
    id: applicationId,
    userId,
    data,
    guestText: renderTemplate('application-guest.md', templateData),
    adminText: renderTemplate('admin-notification.md', templateData),
    fullText: renderTemplate('application.md', templateData),
    createdAt: new Date().toISOString(),
  };
}
