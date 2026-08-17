import { rooms } from '../../../config/index.js';

/**
 * @param {object} params
 * @param {number} params.adults
 * @param {number} params.children
 * @param {string} [params.bedPreferences]
 */
export function matchRooms({ adults, children, bedPreferences = '' }) {
  const totalGuests = adults + children;
  const prefs = bedPreferences.toLowerCase();

  const matches = [];

  for (const room of rooms.roomTypes) {
    const { min, max } = room.capacity;
    if (totalGuests < min || totalGuests > max) continue;

    const layout = pickLayout(room, totalGuests, prefs);
    matches.push({
      roomTypeId: room.id,
      roomName: room.name,
      description: room.description,
      totalGuests,
      layout,
      layoutDescription: layout?.label ?? room.description,
      capacity: room.capacity,
    });
  }

  return matches;
}

function pickLayout(room, guestCount, prefs) {
  const sorted = [...room.layouts].sort(
    (a, b) => Math.abs(a.guestCount - guestCount) - Math.abs(b.guestCount - guestCount),
  );

  if (!prefs) return sorted[0];

  const prefMatch = sorted.find((l) =>
    l.beds.some((b) => prefs.includes(b.toLowerCase().slice(0, 6))),
  );
  return prefMatch ?? sorted[0];
}

export function getRoomById(roomTypeId) {
  return rooms.roomTypes.find((r) => r.id === roomTypeId) ?? null;
}
