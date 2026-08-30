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

function buildClarificationText(profile) {
  const partySize = profile?.partySize;
  const adults = profile?.adults;
  const children = profile?.children;
  const ages = profile?.childrenAges || [];

  if (adults != null && children != null && children > 0 && ages.length === 0) {
    if (children === 1) {
      return 'Подскажите, пожалуйста, сколько лет ребёнку? Это важно для правильного размещения.';
    }
    return 'Подскажите, пожалуйста, возраст детей? Это важно для правильного размещения.';
  }

  if (partySize === 3) {
    return 'Буду рада помочь подобрать подходящий вариант. Подскажите, пожалуйста, каким составом планируете отдыхать: сколько взрослых и будут ли дети? Если да, напишите, пожалуйста, их возраст.';
  }

  if (partySize != null && partySize >= 2) {
    return `Буду рада помочь подобрать подходящий вариант. Подскажите, пожалуйста: ${partySize} гостей — это все взрослые или с вами будут дети? Если дети — какого они возраста?`;
  }

  return 'Буду рада помочь подобрать подходящий вариант. Подскажите, пожалуйста: сколько взрослых будет с вами? Есть ли дети, и если да — какого они возраста?';
}

function isRoomSeekingMessage(normalized) {
  return includesAny(normalized, ROOM_SEEKING_MARKERS);
}

/** Сообщения вроде «нас трое» / «мы вдвоём», где важен состав. */
function isGuestCountContext(normalized) {
  if (isRoomSeekingMessage(normalized)) return true;
  if (includesAny(normalized, ['вдвоем', 'втроем'])) return true;
  // \b ненадёжен для кириллицы в JS — используем lookahead
  if (/(?:^|\s)нас\s+(\d+|двое|трое|четверо|пятеро)(?![а-яё])/u.test(normalized)) {
    return true;
  }
  if (/(?:на|для)\s+(\d+|двоих|троих|четверых|пятерых)(?![а-яё])/u.test(normalized)) {
    return true;
  }
  return false;
}

function buildProfileFromHistory(history = []) {
  let profile = emptyGuestProfile();
  for (const message of history) {
    if (message?.role !== 'user') continue;
    profile = mergeGuestProfile(profile, extractGuestFacts(message.content || ''));
  }
  return profile;
}

function resolveCompositionProfile(profile, text = '') {
  return mergeGuestProfile(profile || emptyGuestProfile(), extractGuestFacts(text));
}

/**
 * Returns true when we know guest count but not adults/children breakdown,
 * or when children are known without ages needed for placement.
 */
export function needsGuestCompositionClarification(profile, text = '') {
  const current = resolveCompositionProfile(profile, text);
  const normalized = normalizeText(text);
  const ages = current.childrenAges || [];

  // Adults known, but children without ages — age affects cot vs full bed
  if (current.adults != null) {
    if (current.children != null && current.children > 0 && ages.length === 0) {
      return true;
    }
    return false;
  }

  if (!isGuestCountContext(normalized)) return false;

  // Only total count known — need breakdown
  if (current.partySize != null && current.partySize >= 2) return true;

  return false;
}

/**
 * Deterministic pre-AI response when guest composition is insufficient.
 * @returns {string|null}
 */
export function getCompositionClarificationResponse(text, profile, history = []) {
  const merged = mergeGuestProfile(
    buildProfileFromHistory(history),
    resolveCompositionProfile(profile, text)
  );

  if (!needsGuestCompositionClarification(merged, text)) return null;

  return buildClarificationText(merged);
}
