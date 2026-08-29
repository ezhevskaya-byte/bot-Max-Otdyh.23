import { includesAny, normalizeText } from '../text-normalize.js';
import { emptyGuestProfile, extractGuestFacts, mergeGuestProfile } from './profile.js';

const ROOM_SEEKING_MARKERS = [
  'номер',
  'комнат',
  'размест',
  'подбер',
  'подобр',
  'вариант',
  'жиль',
  'останов',
  'приед',
  'заех',
  'бронир',
  'нужен',
  'нужна',
  'нужно',
  'ищем',
  'хотим'
];

function buildClarificationText(partySize) {
  if (partySize === 3) {
    return 'Конечно, помогу подобрать удобный вариант. Подскажите, пожалуйста: трое гостей — это взрослые или с вами будут дети? Если дети — какого они возраста?';
  }

  if (partySize != null && partySize >= 2) {
    return `Конечно, помогу подобрать наиболее удобный вариант. Подскажите, пожалуйста: ${partySize} гостей — это все взрослые или с вами будут дети? Если дети — какого они возраста?`;
  }

  return 'Конечно, помогу подобрать наиболее удобный вариант. Подскажите, пожалуйста: сколько взрослых будет с вами? Есть ли дети, и если да — какого они возраста?';
}

function isRoomSeekingMessage(normalized) {
  return includesAny(normalized, ROOM_SEEKING_MARKERS);
}

function buildProfileFromHistory(history = []) {
  let profile = emptyGuestProfile();
  for (const message of history) {
    if (message?.role !== 'user') continue;
    profile = mergeGuestProfile(profile, extractGuestFacts(message.content || ''));
  }
  return profile;
}

/**
 * Returns true when we know guest count but not adults/children breakdown.
 */
export function needsGuestCompositionClarification(profile, text = '') {
  const current = profile || emptyGuestProfile();
  const normalized = normalizeText(text);

  if (!isRoomSeekingMessage(normalized)) return false;

  // Composition is clear enough
  if (current.adults != null) return false;

  // Only total count known — need breakdown
  if (current.partySize != null && current.partySize >= 2) return true;

  // Explicit guest count in current message without adults
  const fresh = extractGuestFacts(text);
  if (fresh.partySize != null && fresh.partySize >= 2 && fresh.adults == null) {
    return true;
  }

  return false;
}

/**
 * Deterministic pre-AI response when guest composition is insufficient.
 * @returns {string|null}
 */
export function getCompositionClarificationResponse(text, profile, history = []) {
  const merged = mergeGuestProfile(buildProfileFromHistory(history), profile || emptyGuestProfile());
  merged.partySize = merged.partySize ?? extractGuestFacts(text).partySize;

  if (!needsGuestCompositionClarification(merged, text)) return null;

  return buildClarificationText(merged.partySize);
}
