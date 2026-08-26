import { includesAny } from '../text-normalize.js';
import { emptyGuestProfile, guestPartySize } from '../guest-context/profile.js';
import {
  joinSections,
  ROOM_FOLDER_KNOWLEDGE,
  sliceByHeading,
  KNOWLEDGE_FILES
} from './loader.js';

export const ROOM_SECTIONS = {
  COMFORT: 'room_comfort',
  DELUXE_2: 'room_deluxe_2',
  DELUXE_3: 'room_deluxe_3',
  FAMILY: 'room_family',
  GENERAL_RULES: 'room_general_rules'
};

export const ALL_ROOM_SECTIONS = [
  ROOM_SECTIONS.GENERAL_RULES,
  ROOM_SECTIONS.COMFORT,
  ROOM_SECTIONS.DELUXE_2,
  ROOM_SECTIONS.DELUXE_3,
  ROOM_SECTIONS.FAMILY
];

/** Низкая уверенность по категории: 2–3 раздела, не полный dump ~34k. */
export const LOW_CONFIDENCE_ROOM_SECTIONS = [
  ROOM_SECTIONS.GENERAL_RULES,
  ROOM_SECTIONS.COMFORT,
  ROOM_SECTIONS.FAMILY
];

const SALES_STOPS_PRIORITY = ['ПРАВИЛА ПОДБОРА', 'КАК AI ДОЛЖЕН ОПИСЫВАТЬ КОМНАТЫ'];

function sales(heading, stops) {
  return sliceByHeading(KNOWLEDGE_FILES.salesRules, heading, stops);
}

/**
 * Только общие правила размещения — без описаний конкретных комнат.
 */
export function buildRoomGeneralRulesSection() {
  return joinSections([
    'РАЗДЕЛ: ОБЩИЕ ПРАВИЛА РАЗМЕЩЕНИЯ',
    'Конкретные описания комнат подключаются отдельно и только если они относятся к запросу.',
    '',
    'Вместимость:',
    '— «Комфорт»: до 3 гостей; возможен вариант с детской кроваткой.',
    '— «Делюкс»: до 4 гостей.',
    '— «Семейная»: до 5 гостей.',
    '',
    'Возраст детей:',
    '— детская кроватка — для ребёнка до 4 лет, по запросу, без дополнительной платы;',
    '— ребёнку 5 лет и старше нужно полноценное спальное место, не кроватка.',
    '',
    'Кроватка:',
    '— в «Комфорт» установить можно;',
    '— в «Делюкс» при 2 или 3 гостях установить можно;',
    '— в «Делюкс» при размещении 4 гостей детскую кроватку НЕ устанавливаем;',
    '— не предлагать конфигурацию «Делюкс = 4 гостя + детская кроватка»;',
    '— если нужны 4 гостя и кроватка — рекомендовать «Семейную»;',
    '— в «Семейной» кроватку установить можно.',
    '',
    'Логика комфорта размещения:',
    '— 2 взрослых + 1 ребёнок: в первую очередь «Комфорт»; «Семейную» — как более просторную альтернативу.',
    '— 2 взрослых + 2 ребёнка: приоритет «Семейная».',
    '— 3 взрослых: «Комфорт» допустим как компактный вариант; если нужно больше пространства — «Делюкс» или «Семейная».',
    '— 4 гостя: «Делюкс» или «Семейная»; при кроватке — только «Семейная».',
    '— семья из 5, включая семью со взрослыми детьми: «Семейная» допустима и может быть хорошим вариантом.',
    '',
    'Правило компании взрослых:',
    '— компания из 4–5 отдельных взрослых: не говорить, что размещение в «Семейной» запрещено или невозможно;',
    '— не отказывать автоматически;',
    '— мягко предложить две комнаты как более комфортный вариант: больше личного пространства и удобнее для компании взрослых.',
    '',
    'Общие принципы подбора:',
    '— подобрать наиболее комфортный и логичный вариант, а не самую дорогую комнату автоматически;',
    '— сначала основной вариант, затем при необходимости более просторная альтернатива;',
    '— не придумывать различия «Делюкс» 2 и 3 этажа, кроме балкона: 2 этаж — небольшой французский балкон, 3 этаж — большой балкон с уличной мебелью;',
    '— не подтверждать наличие мест и стоимость без администратора.'
  ]);
}

const ROOM_SECTION_BUILDERS = {
  [ROOM_SECTIONS.GENERAL_RULES]: buildRoomGeneralRulesSection,
  [ROOM_SECTIONS.COMFORT]: () =>
    joinSections(['РАЗДЕЛ: КОМНАТА КОМФОРТ', ROOM_FOLDER_KNOWLEDGE[ROOM_SECTIONS.COMFORT]]),
  [ROOM_SECTIONS.DELUXE_2]: () =>
    joinSections(['РАЗДЕЛ: КОМНАТА ДЕЛЮКС 2 ЭТАЖ', ROOM_FOLDER_KNOWLEDGE[ROOM_SECTIONS.DELUXE_2]]),
  [ROOM_SECTIONS.DELUXE_3]: () =>
    joinSections(['РАЗДЕЛ: КОМНАТА ДЕЛЮКС 3 ЭТАЖ', ROOM_FOLDER_KNOWLEDGE[ROOM_SECTIONS.DELUXE_3]]),
  [ROOM_SECTIONS.FAMILY]: () =>
    joinSections(['РАЗДЕЛ: КОМНАТА СЕМЕЙНАЯ', ROOM_FOLDER_KNOWLEDGE[ROOM_SECTIONS.FAMILY]])
};

export function buildRoomSectionsContext(sectionIds = []) {
  const unique = [];
  for (const id of sectionIds) {
    if (!ROOM_SECTION_BUILDERS[id] || unique.includes(id)) continue;
    unique.push(id);
  }

  if (unique.length === 0) {
    unique.push(ROOM_SECTIONS.GENERAL_RULES);
  } else if (!unique.includes(ROOM_SECTIONS.GENERAL_RULES)) {
    unique.unshift(ROOM_SECTIONS.GENERAL_RULES);
  }

  return unique
    .map((id) => ROOM_SECTION_BUILDERS[id]())
    .filter((section) => section && section.trim())
    .join('\n\n-----------------------------\n\n');
}

/**
 * Полный dump комнат STAGE 3A — только для сравнения экономии, не для live.
 */
export function buildFullRoomsTopicSection() {
  return joinSections([
    'РАЗДЕЛ: КОМНАТЫ И РАЗМЕЩЕНИЕ',
    KNOWLEDGE_FILES.rooms,
    sales('ПРИОРИТЕТ ПОДБОРА КОМНАТ', SALES_STOPS_PRIORITY),
    sales('ПРАВИЛА ПОДБОРА', ['КАК AI ДОЛЖЕН ОПИСЫВАТЬ КОМНАТЫ'])
  ]);
}

function mentionsComfort(normalized) {
  const withoutAdjective = normalized.replace(/комфортн[а-я]*/g, ' ');
  return includesAny(withoutAdjective, ['комфорт']);
}

function mentionsFamily(normalized) {
  return includesAny(normalized, ['семейн']);
}

function mentionsDeluxe(normalized) {
  return includesAny(normalized, ['делюкс']);
}

function mentionsDeluxe2(normalized) {
  if (!mentionsDeluxe(normalized)) return false;
  return (
    includesAny(normalized, ['втор', 'французск', 'небольш']) ||
    /делюкс\s*2|\b2\s*этаж/.test(normalized)
  );
}

function mentionsDeluxe3(normalized) {
  if (!mentionsDeluxe(normalized)) return false;
  return (
    includesAny(normalized, ['трет', 'мебел', 'уличн']) ||
    /делюкс\s*3|\b3\s*этаж/.test(normalized) ||
    (includesAny(normalized, ['больш']) && includesAny(normalized, ['балкон']))
  );
}

function isDeluxeComparison(normalized) {
  const hasDeluxe = mentionsDeluxe(normalized);
  const hasCompare = includesAny(normalized, ['отлича', 'разниц', 'отличие', 'сравн']);
  const twoAndThree =
    (includesAny(normalized, ['2', 'втор']) && includesAny(normalized, ['3', 'трет']));
  return hasDeluxe && (hasCompare || twoAndThree);
}

function wantsLargeBalcony(normalized, profile) {
  if (profile?.balconyPreference === 'large') return true;
  if (!includesAny(normalized, ['балкон'])) return false;
  return includesAny(normalized, ['больш', 'простор', 'посидеть', 'мебел', 'уличн']);
}

function wantsFrenchBalcony(normalized, profile) {
  if (profile?.balconyPreference === 'french') return true;
  return includesAny(normalized, ['французск']);
}

function youngestChildAge(profile) {
  const ages = profile?.childrenAges || [];
  if (!ages.length) return null;
  return Math.min(...ages);
}

function needsBabyCot(normalized, profile) {
  if (profile?.babyCot === true) return true;
  if (includesAny(normalized, ['кроватк', 'манеж'])) return true;
  const age = youngestChildAge(profile);
  if (age != null && age <= 4) return true;
  return false;
}

function isFamilyGroup(normalized, profile) {
  if (profile?.groupType === 'family') return true;
  return includesAny(normalized, ['семь', 'семьи', 'семьей', 'семьёй', 'ребен', 'дет']);
}

function isAdultFriends(normalized, profile) {
  if (profile?.groupType === 'friends') return true;
  if (includesAny(normalized, ['друз', 'компани']) && !isFamilyGroup(normalized, profile)) {
    return true;
  }
  return (
    includesAny(normalized, ['взрослых друз', 'пятеро взрослых', 'пять взрослых']) &&
    !isFamilyGroup(normalized, profile)
  );
}

function namedCategorySections(normalized) {
  const named = [];
  if (mentionsComfort(normalized)) named.push(ROOM_SECTIONS.COMFORT);
  if (isDeluxeComparison(normalized)) {
    named.push(ROOM_SECTIONS.DELUXE_2, ROOM_SECTIONS.DELUXE_3);
    return named;
  }
  const d2 = mentionsDeluxe2(normalized);
  const d3 = mentionsDeluxe3(normalized);
  if (d2) named.push(ROOM_SECTIONS.DELUXE_2);
  if (d3) named.push(ROOM_SECTIONS.DELUXE_3);
  if (mentionsDeluxe(normalized) && !d2 && !d3) {
    named.push(ROOM_SECTIONS.DELUXE_2, ROOM_SECTIONS.DELUXE_3);
  }
  if (mentionsFamily(normalized)) named.push(ROOM_SECTIONS.FAMILY);
  return named;
}

function compositionSections(normalized, profile) {
  const selected = [];
  const size = guestPartySize(profile, normalized);
  const cot = needsBabyCot(normalized, profile);
  const largeBalcony = wantsLargeBalcony(normalized, profile);
  const frenchBalcony = wantsFrenchBalcony(normalized, profile);
  const adults = profile?.adults;
  const children = profile?.children;
  const friends = isAdultFriends(normalized, profile);
  const family = isFamilyGroup(normalized, profile);

  if (largeBalcony) {
    selected.push(ROOM_SECTIONS.DELUXE_3);
    if (cot && (size == null || size >= 4)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (frenchBalcony && !largeBalcony) {
    selected.push(ROOM_SECTIONS.DELUXE_2);
  }

  if (size === 5 || includesAny(normalized, ['нас пятеро', 'семья из пяти', 'пять гост', '5 гост'])) {
    selected.push(ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (cot && (size === 4 || includesAny(normalized, ['четверо', '4 гост', 'четыре гост']))) {
    selected.push(ROOM_SECTIONS.FAMILY);
    if (mentionsDeluxe(normalized)) {
      selected.push(ROOM_SECTIONS.DELUXE_2, ROOM_SECTIONS.DELUXE_3);
    }
    return selected;
  }

  if (adults === 2 && children === 2) {
    selected.push(ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (adults === 2 && children === 1) {
    selected.push(ROOM_SECTIONS.COMFORT);
    if (includesAny(normalized, ['простор', 'побольше', 'семейн'])) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (size === 4 && !cot) {
    selected.push(ROOM_SECTIONS.DELUXE_2, ROOM_SECTIONS.DELUXE_3, ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (size === 3 && !cot) {
    selected.push(ROOM_SECTIONS.COMFORT, ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (friends && (size == null || size >= 4)) {
    selected.push(ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (family && (children == null || children >= 1) && size == null) {
    selected.push(ROOM_SECTIONS.COMFORT, ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (size === 2) {
    selected.push(ROOM_SECTIONS.COMFORT);
    return selected;
  }

  return selected;
}

function uniqueSections(ids) {
  const result = [];
  for (const id of ids) {
    if (id && !result.includes(id)) result.push(id);
  }
  return result;
}

/**
 * Выбирает разделы комнат для текущего запроса.
 * Не угадывает состав: опирается на текст и подтверждённый guest profile.
 */
export function selectRoomSections({
  normalized = '',
  guestProfile = null,
  previousRoomSections = [],
  followUp = false,
  lowConfidence = false
} = {}) {
  const profile = guestProfile || emptyGuestProfile();

  if (lowConfidence) {
    return [...LOW_CONFIDENCE_ROOM_SECTIONS];
  }

  const named = namedCategorySections(normalized);
  const fromComposition = compositionSections(normalized, profile);
  const largeBalcony = wantsLargeBalcony(normalized, profile);

  let selected = [];

  if (named.length) {
    selected = [...named];
    if (largeBalcony && !selected.includes(ROOM_SECTIONS.DELUXE_3)) {
      selected.push(ROOM_SECTIONS.DELUXE_3);
    }
    if (
      needsBabyCot(normalized, profile) &&
      (guestPartySize(profile, normalized) === 4 ||
        includesAny(normalized, ['четверо', '4 гост', 'четыре гост', 'нас 4']))
    ) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
  } else if (fromComposition.length) {
    selected = [...fromComposition];
  } else if (followUp && previousRoomSections.length) {
    selected = previousRoomSections.filter((id) => id !== ROOM_SECTIONS.GENERAL_RULES);
  } else {
    selected = LOW_CONFIDENCE_ROOM_SECTIONS.filter(
      (id) => id !== ROOM_SECTIONS.GENERAL_RULES
    );
  }

  selected = uniqueSections(selected);

  if (!selected.includes(ROOM_SECTIONS.GENERAL_RULES)) {
    selected = [ROOM_SECTIONS.GENERAL_RULES, ...selected];
  }

  const descriptionSections = selected.filter((id) => id !== ROOM_SECTIONS.GENERAL_RULES);
  if (descriptionSections.length === 0) {
    selected = [...LOW_CONFIDENCE_ROOM_SECTIONS];
  }

  return uniqueSections(selected);
}

export { ROOM_SECTION_BUILDERS };
