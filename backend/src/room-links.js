import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
export const ROOM_LINKS_PATH = join(PROJECT_ROOT, 'data', 'room-links.json');

let cachedLinks = null;

export function loadRoomLinks() {
  if (cachedLinks) return cachedLinks;

  if (!existsSync(ROOM_LINKS_PATH)) {
    cachedLinks = [];
    return cachedLinks;
  }

  const data = JSON.parse(readFileSync(ROOM_LINKS_PATH, 'utf-8'));
  cachedLinks = Array.isArray(data) ? data : [];
  return cachedLinks;
}

export function findRoomLink(roomId, scenarioId) {
  if (!roomId || !scenarioId) return null;

  return (
    loadRoomLinks().find(
      (item) => item.room_id === roomId && item.scenario_id === scenarioId
    ) || null
  );
}

export function formatRoomLinkMessage(link) {
  if (!link) return '';

  return [
    'Для вашего размещения подойдёт вариант:',
    link.title,
    '',
    'Преимущество:',
    link.feature,
    '',
    'Посмотреть фотографии и подробное описание:',
    link.url
  ].join('\n');
}

const CATEGORY_TITLES = {
  comfort: 'Комфорт',
  'deluxe-2': 'Делюкс',
  'deluxe-3': 'Делюкс',
  family: 'Семейная'
};

export function formatRoomPhotoMessage(link, categoryTitle = null) {
  if (!link) return '';

  const title =
    categoryTitle ||
    CATEGORY_TITLES[link.room_id] ||
    link.title;

  return [
    `Конечно. Вот фотографии категории «${title}»:`,
    link.url,
    '',
    'Если вариант вам понравится, подскажите даты поездки — помогу сориентироваться по следующему шагу.'
  ].join('\n');
}
