import {
  isPhotoRequest,
  detectRequestedRoom,
  getRoomPhotoLink,
  getWebsiteRoomLink
} from '../photo-service.js';
import { formatRoomLinkMessage } from '../room-links.js';

export const PHOTO_CLARIFY_TEXT =
  'Конечно, покажу фото. Уточните, пожалуйста, какую категорию номера хотите посмотреть: Комфорт, Делюкс 2 этаж, Делюкс 3 этаж или Семейный?';

/**
 * Существующий zero-token путь комнат.
 * Не переписывает photo-service / room-links, только собирает ответ.
 */
export function matchRoomLink({ text, lastAssistantText = '' }) {
  if (!isPhotoRequest(text)) return null;

  const roomKey = detectRequestedRoom(text, lastAssistantText);
  const websiteLink = getWebsiteRoomLink(roomKey, text, lastAssistantText);

  if (websiteLink) {
    return {
      handled: true,
      type: 'room-link',
      text: formatRoomLinkMessage(websiteLink),
      data: {
        roomKey,
        room_id: websiteLink.room_id,
        scenario_id: websiteLink.scenario_id,
        url: websiteLink.url
      }
    };
  }

  if (!roomKey) {
    return {
      handled: true,
      type: 'room-link',
      text: PHOTO_CLARIFY_TEXT,
      data: { roomKey: null, needsClarification: true }
    };
  }

  const roomInfo = getRoomPhotoLink(roomKey, text, lastAssistantText);

  if (!roomInfo) {
    return {
      handled: true,
      type: 'room-link',
      text: PHOTO_CLARIFY_TEXT,
      data: { roomKey, needsClarification: true }
    };
  }

  return {
    handled: true,
    type: 'room-link',
    text: [`📸 Фотографии категории «${roomInfo.title}»:`, '', roomInfo.url].join('\n'),
    data: {
      roomKey,
      fallbackPhoto: true,
      url: roomInfo.url
    }
  };
}
