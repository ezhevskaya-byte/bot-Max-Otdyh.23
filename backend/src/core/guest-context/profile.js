import { includesAny, normalizeText } from '../text-normalize.js';

const COUNT_WORDS = {
  один: 1,
  одна: 1,
  одно: 1,
  два: 2,
  две: 2,
  двое: 2,
  двум: 2,
  двоих: 2,
  двух: 2,
  вдвоем: 2,
  три: 3,
  трое: 3,
  троим: 3,
  троих: 3,
  трех: 3,
  втроем: 3,
  четыре: 4,
  четверо: 4,
  четверых: 4,
  четырех: 4,
  пять: 5,
  пятеро: 5,
  пятерых: 5,
  пяти: 5
};

const COUNT_ALT = Object.keys(COUNT_WORDS).join('|');

/** Словесные числа возраста ребёнка. Не общий NLP — только разумный детский диапазон. */
const AGE_WORDS = {
  один: 1,
  одна: 1,
  одно: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17
};

const AGE_ALT = Object.keys(AGE_WORDS).join('|');

function parseAgeToken(token) {
  if (!token) return null;
  if (AGE_WORDS[token] != null) return AGE_WORDS[token];
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return n >= 0 && n <= 17 ? n : null;
  }
  return null;
}

function parseCountToken(token) {
  if (!token) return null;
  if (COUNT_WORDS[token] != null) return COUNT_WORDS[token];
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return n > 0 && n <= 12 ? n : null;
  }
  return null;
}

function firstMatchCount(normalized, pattern) {
  const match = normalized.match(pattern);
  if (!match) return null;
  return parseCountToken(match[1]);
}

function uniqueNumbers(values) {
  const result = [];
  for (const value of values) {
    if (Number.isFinite(value) && !result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

export function emptyGuestProfile() {
  return {
    adults: null,
    children: null,
    childrenAges: [],
    dates: null,
    babyCot: null,
    balconyPreference: null,
    selectedRoom: null,
    selectedScenario: null,
    partySize: null,
    groupType: null
  };
}

export function isGuestProfileEmpty(profile) {
  if (!profile) return true;
  return (
    profile.adults == null &&
    profile.children == null &&
    (!profile.childrenAges || profile.childrenAges.length === 0) &&
    profile.dates == null &&
    profile.babyCot == null &&
    profile.balconyPreference == null &&
    profile.selectedRoom == null &&
    profile.selectedScenario == null &&
    profile.partySize == null &&
    profile.groupType == null
  );
}

function extractAdults(normalized) {
  const counted = firstMatchCount(
    normalized,
    new RegExp(`(\\d+|${COUNT_ALT})\\s*взросл`, 'u')
  );
  if (counted != null) return counted;
  // «оба взрослые» / «мы вдвоём, оба взрослые»
  if (includesAny(normalized, ['оба взросл', 'обе взросл'])) return 2;
  return null;
}

function extractChildrenCount(normalized) {
  const withWord = firstMatchCount(
    normalized,
    new RegExp(`(\\d+|${COUNT_ALT})\\s*(?:ребен|дет)`, 'u')
  );
  if (withWord != null) return withWord;

  if (includesAny(normalized, ['и дети', 'и детей', 'детей'])) {
    const ages = extractChildrenAges(normalized);
    if (ages.length > 0) return ages.length;
  }

  if (includesAny(normalized, ['с ребенком', 'и ребенок', 'и ребенка', 'ребенку'])) {
    return 1;
  }
  return null;
}

function extractChildrenAges(normalized) {
  const ages = [];
  const patterns = [
    new RegExp(
      `ребен(?:ка|ку|ок|ком)?\\s+(\\d+|${AGE_ALT})\\s*(?:год|года|лет|месяц)`,
      'g'
    ),
    // «двое детей 5 и 9 лет» / «детей 5 и 9 лет»
    /дет(?:ей|и)\s+(\d+)\s+и\s+(\d+)\s*(?:год|года|лет)?/g,
    // «дети 5 лет и 9 лет»
    /дети\s+(\d+)\s*(?:год|года|лет)\s+и\s+(\d+)\s*(?:год|года|лет)/g,
    /детям\s+(\d+)\s+и\s+(\d+)/g,
    /дети\s+(\d+)\s*(?:,|и)\s*(\d+)/g,
    /дети\s+(\d+)\s*,\s*(\d+)\s+и\s+(\d+)\s*(?:год|года|лет)?/g,
    /дети\s+(\d+)\s+(\d+)\s+и\s+(\d+)\s*(?:год|года|лет)?/g,
    /возраст(?:ы)?\s+(\d+)\s*(?:,|и)\s*(\d+)/g
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const first = parseAgeToken(match[1]);
      const second = parseAgeToken(match[2]);
      const third = parseAgeToken(match[3]);
      if (first != null) ages.push(first);
      if (second != null) ages.push(second);
      if (third != null) ages.push(third);
    }
  }

  return uniqueNumbers(ages.filter((n) => n >= 0 && n <= 17));
}

function extractPartySize(normalized) {
  const fromPhrase = firstMatchCount(
    normalized,
    new RegExp(`(?:нас|семья из|семьи из)\\s+(\\d+|${COUNT_ALT})`, 'u')
  );
  if (fromPhrase != null) return fromPhrase;

  const onGuests = firstMatchCount(
    normalized,
    new RegExp(`(?:на|для)\\s+(\\d+|${COUNT_ALT})\\s*(?:гост[а-я]*|человек[а-я]*|чел)`, 'u')
  );
  if (onGuests != null) return onGuests;

  // «на троих» / «для двоих» без слова «человек».
  // Не путать с этажом и длительностью: «на 2 этаже», «на 3 дня», «трое суток».
  const durationOrFloor =
    '(?:этаж|день|дня|дней|сутки|суток|ночь|ночи|ночей)';
  const onCountOnly = firstMatchCount(
    normalized,
    new RegExp(`(?:на|для)\\s+(\\d+|${COUNT_ALT})(?!\\s*${durationOrFloor})`, 'u')
  );
  if (onCountOnly != null) return onCountOnly;

  const guests = firstMatchCount(
    normalized,
    new RegExp(`(\\d+|${COUNT_ALT})\\s*(?:гост[а-я]*|человек[а-я]*|чел)`, 'u')
  );
  if (guests != null) return guests;

  if (includesAny(normalized, ['вдвоем'])) return 2;
  if (includesAny(normalized, ['втроем'])) return 3;
  return null;
}

function extractBabyCot(normalized) {
  if (!includesAny(normalized, ['кроватк', 'манеж'])) return null;
  if (includesAny(normalized, ['не нужн', 'без кроват', 'кроватка не'])) return false;
  return true;
}

function extractBalconyPreference(normalized) {
  if (!includesAny(normalized, ['балкон'])) return null;
  if (includesAny(normalized, ['больш', 'простор', 'посидеть', 'мебел', 'уличн'])) {
    return 'large';
  }
  if (includesAny(normalized, ['французск', 'небольш'])) return 'french';
  return null;
}

function extractDates(normalized) {
  const range = normalized.match(
    /(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\s*(?:-|по|до)\s*(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/
  );
  if (range) {
    return { checkIn: range[1], checkOut: range[2] };
  }
  return null;
}

function extractSelectedRoom(normalized) {
  const choosing = includesAny(normalized, [
    'берем',
    'берём',
    'хотим комфорт',
    'хотим делюкс',
    'хотим семейн',
    'эта комната',
    'этот номер',
    'остановимся',
    'выберем'
  ]);
  if (!choosing) return null;
  if (includesAny(normalized, ['комфорт'])) return 'comfort';
  if (includesAny(normalized, ['семейн'])) return 'family';
  if (includesAny(normalized, ['делюкс'])) return 'deluxe';
  return null;
}

function extractGroupType(normalized) {
  if (includesAny(normalized, ['друз', 'компания взрослых', 'взрослых друз'])) {
    return 'friends';
  }
  if (includesAny(normalized, ['семья', 'семьи', 'семьей', 'одна семья'])) {
    return 'family';
  }
  return null;
}

/**
 * Извлекает только явно сказанные факты. Не заполняет поля догадками.
 */
export function extractGuestFacts(text) {
  const normalized = normalizeText(text);
  const facts = emptyGuestProfile();
  if (!normalized) return facts;

  facts.adults = extractAdults(normalized);
  facts.children = extractChildrenCount(normalized);
  facts.childrenAges = extractChildrenAges(normalized);
  if (facts.children == null && facts.childrenAges.length > 0) {
    facts.children = facts.childrenAges.length;
  }
  facts.partySize = extractPartySize(normalized);
  facts.babyCot = extractBabyCot(normalized);
  facts.balconyPreference = extractBalconyPreference(normalized);
  facts.dates = extractDates(normalized);
  facts.selectedRoom = extractSelectedRoom(normalized);
  facts.groupType = extractGroupType(normalized);

  if (facts.adults != null || facts.children != null) {
    facts.partySize = (facts.adults || 0) + (facts.children || 0);
  }

  return facts;
}

export function mergeGuestProfile(base, incoming) {
  const current = { ...emptyGuestProfile(), ...(base || {}) };
  const next = incoming || emptyGuestProfile();

  const merged = { ...current };

  for (const key of [
    'adults',
    'children',
    'dates',
    'babyCot',
    'balconyPreference',
    'selectedRoom',
    'selectedScenario',
    'partySize',
    'groupType'
  ]) {
    if (next[key] != null && next[key] !== '') {
      merged[key] = next[key];
    }
  }

  merged.childrenAges = uniqueNumbers([
    ...(current.childrenAges || []),
    ...(next.childrenAges || [])
  ]);

  if (merged.children == null && merged.childrenAges.length > 0) {
    merged.children = merged.childrenAges.length;
  }

  if (merged.adults != null || merged.children != null) {
    merged.partySize = (merged.adults || 0) + (merged.children || 0);
  }

  return merged;
}

export function guestPartySize(profile, normalized = '') {
  if (profile?.adults != null || profile?.children != null) {
    return (profile.adults || 0) + (profile.children || 0);
  }
  if (profile?.partySize != null) return profile.partySize;
  return extractPartySize(normalized);
}

function labelOrUnknown(value, map) {
  if (value == null || value === '') return null;
  if (map) return map[value] || String(value);
  return String(value);
}

/**
 * Компактный блок для LLM. Без сырой переписки и без выдуманных полей.
 */
export function formatGuestProfileForLlm(profile) {
  const current = profile || emptyGuestProfile();
  const lines = [
    'ПРОФИЛЬ ГОСТЯ',
    'Только подтверждённые данные. Если поля нет — оно неизвестно; не выдумывай состав гостей.'
  ];

  if (isGuestProfileEmpty(current)) {
    lines.push('Подтверждённых данных о составе, датах и пожеланиях пока нет.');
    return lines.join('\n');
  }

  if (current.adults != null) lines.push(`Взрослые: ${current.adults}`);
  if (current.children != null) lines.push(`Дети: ${current.children}`);
  if (current.childrenAges?.length) {
    lines.push(`Возраст: ${current.childrenAges.join(', ')}`);
  }
  if (
    current.adults == null &&
    current.children == null &&
    current.partySize != null
  ) {
    lines.push(`Всего гостей: ${current.partySize}`);
  }
  if (current.babyCot === true) lines.push('Кроватка: да');
  if (current.babyCot === false) lines.push('Кроватка: нет');
  if (current.balconyPreference === 'large') {
    lines.push('Пожелание: большой балкон');
  }
  if (current.balconyPreference === 'french') {
    lines.push('Пожелание: французский балкон');
  }
  if (current.dates?.checkIn || current.dates?.checkOut) {
    lines.push(
      `Даты: ${current.dates.checkIn || '?'} – ${current.dates.checkOut || '?'}`
    );
  }
  const room = labelOrUnknown(current.selectedRoom, {
    comfort: 'Комфорт',
    deluxe: 'Делюкс',
    family: 'Семейная'
  });
  if (room) lines.push(`Выбранная комната: ${room}`);
  if (current.selectedScenario) {
    lines.push(`Сценарий: ${current.selectedScenario}`);
  }
  if (current.groupType === 'family') lines.push('Тип группы: семья');
  if (current.groupType === 'friends') lines.push('Тип группы: компания взрослых');

  return lines.join('\n');
}

export function profileSearchText(profile) {
  const current = profile || emptyGuestProfile();
  const bits = [];
  if (current.adults != null) bits.push(`${current.adults} взрослых`);
  if (current.adults === 2) bits.push('двое взрослых', '2 взрослых');
  if (current.children === 1) bits.push('ребёнок', 'ребенок', 'один ребёнок');
  if (current.children === 2) bits.push('двое детей', '2 ребёнка');
  for (const age of current.childrenAges || []) {
    bits.push(`${age} лет`);
  }
  if (current.babyCot === true) bits.push('кроватка', 'детская кроватка');
  if (current.partySize === 4) bits.push('четверо', '4 гост');
  if (current.partySize === 5) bits.push('пятеро', '5 гост');
  if (current.balconyPreference === 'large') bits.push('большой балкон');
  if (current.groupType === 'family') bits.push('семья');
  if (current.groupType === 'friends') bits.push('друзей', 'компания');
  return bits.join(' ');
}
