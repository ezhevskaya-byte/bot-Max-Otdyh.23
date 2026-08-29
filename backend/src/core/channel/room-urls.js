import { loadRoomLinks } from '../../room-links.js';

/**
 * Category-level URL map built from room-links.json.
 * Uses the first scenario per room_id as category landing page.
 */
let categoryUrlCache = null;

export function getCategoryRoomUrls() {
  if (categoryUrlCache) return categoryUrlCache;

  const links = loadRoomLinks();
  const map = {
    comfort: null,
    deluxe: null,
    family: null
  };

  for (const link of links) {
    if (link.room_id === 'comfort' && !map.comfort) {
      map.comfort = { title: 'Комфорт', url: link.url };
    }
    if ((link.room_id === 'deluxe-2' || link.room_id === 'deluxe-3') && !map.deluxe) {
      map.deluxe = { title: 'Делюкс', url: link.url };
    }
    if (link.room_id === 'family' && !map.family) {
      map.family = { title: 'Семейная', url: link.url };
    }
  }

  categoryUrlCache = map;
  return map;
}

export function formatCategoryUrlsForHint() {
  const urls = getCategoryRoomUrls();
  const lines = ['КАНОНИЧЕСКИЕ URL КАТЕГОРИЙ (используй только эти, не главную страницу):'];

  if (urls.comfort) lines.push(`«Комфорт»: ${urls.comfort.url}`);
  if (urls.deluxe) lines.push(`«Делюкс»: ${urls.deluxe.url}`);
  if (urls.family) lines.push(`«Семейная»: ${urls.family.url}`);

  return lines.join('\n');
}
