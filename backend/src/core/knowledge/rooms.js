import { includesAny } from '../text-normalize.js';
import {
  emptyGuestProfile,
  extractGuestFacts,
  guestPartySize,
  mergeGuestProfile
} from '../guest-context/profile.js';
import {
  joinSections,
  ROOM_FOLDER_MAP,
  sliceByHeading,
  KNOWLEDGE_FILES
} from './loader.js';
import { buildRoomFolderLiveKnowledge } from './room-live.js';

/** Для маршрутизации: если профиль пуст, берём состав из текущего текста. */
function profileForRouting(guestProfile, normalized = '') {
  const current = guestProfile || emptyGuestProfile();
  if (
    current.adults != null ||
    current.children != null ||
    (current.partySize != null && current.childrenAges?.length)
  ) {
    return current;
  }
  return mergeGuestProfile(current, extractGuestFacts(normalized));
}

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

/** Низкая уверенность: Comfort + Deluxe + Family, без полного dump всех сценариев. */
export const LOW_CONFIDENCE_ROOM_SECTIONS = [
  ROOM_SECTIONS.GENERAL_RULES,
  ROOM_SECTIONS.COMFORT,
  ROOM_SECTIONS.DELUXE_2,
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
    'Логика подбора и альтернатив:',
    '— 2 взрослых + 1 ребёнок: по умолчанию сначала «Комфорт»; если гость сам выбрал подходящий «Делюкс» или «Семейную» — сначала ответить про выбранную категорию, не переубеждать.',
    '— 2 взрослых + 2 ребёнка: приоритет «Семейная»; если гость сам спросил другую подходящую категорию — сначала про неё.',
    '— 3 взрослых / 3 гостя: можно рассмотреть «Комфорт» или «Делюкс» по составу и пожеланиям; «Семейную» — если нужен больший простор или две зоны, либо если гость сам её выбрал.',
    '— если гость явно спросил про конкретную категорию и она подходит по вместимости и правилам — рассказать про неё; не переводить автоматически на другую;',
    '— если выбранная категория не подходит по вместимости — мягко объяснить через комфорт и предложить альтернативу (без «нельзя» / «вам не нужна»).',
    '— 4 взрослых: число гостей само по себе недостаточно — учитывать характер компании.',
    '— 4 взрослых, одна семья (родители + взрослые дети, родственники): можно рекомендовать «Семейную» — две жилые зоны, больше пространства, размещение вместе; другие варианты — по пожеланиям.',
    '— 4 взрослых, не одна семья (две пары, друзья, компания без семейной связи): НЕ рекомендовать один «Делюкс» первым вариантом.',
    '— 4 взрослых, не одна семья — приоритет: 1) два отдельных номера (личное пространство, свой санузел у каждой пары/гостей, комфорт при разном режиме отдыха); 2) «Семейная», если хотят жить вместе (две жилые зоны); 3) «Делюкс» только как компромисс (один номер / без двух зон / бюджет и пожелания).',
    '— 4 взрослых: не говорить «неудобно», «нельзя», «вам не подойдёт»; объяснять через комфорт: «обычно для такой компании удобнее…», «чтобы у каждого было своё пространство…».',
    '— 4 гостя с детьми / семейный состав: по правилам состава; при кроватке на 4 гостей — только «Семейная».',
    '— семья из 5, включая семью со взрослыми детьми: «Семейная» допустима и может быть хорошим вариантом.',
    '',
    'Правило компании взрослых:',
    '— компания из 4–5 отдельных взрослых: не говорить, что размещение в «Семейной» запрещено или невозможно;',
    '— не отказывать автоматически;',
    '— для 4 взрослых не из одной семьи сначала мягко предложить два номера; «Семейную» — если хотят вместе; «Делюкс» — компромисс одного номера;',
    '— для 5 взрослых друзей мягко предложить две комнаты как более комфортный вариант: больше личного пространства.',
    '',
    'Общие принципы подбора:',
    '— подобрать наиболее комфортный и логичный вариант, а не самую дорогую комнату автоматически;',
    '— сначала основной подходящий вариант, затем следующая рациональная альтернатива через её собственные преимущества;',
    '— не продавать категорию через недостатки другой;',
    '— не придумывать различия «Делюкс» 2 и 3 этажа, кроме балкона: 2 этаж — небольшой французский балкон, 3 этаж — большой балкон с уличной мебелью;',
    '— не подтверждать наличие мест и стоимость без администратора.'
  ]);
}

function buildLiveRoomSection(title, sectionId, options = {}) {
  const folder = ROOM_FOLDER_MAP[sectionId];
  const body = buildRoomFolderLiveKnowledge(folder, options);
  return joinSections([title, body]);
}

export function buildRoomSectionsContext(sectionIds = [], options = {}) {
  const unique = [];
  for (const id of sectionIds) {
    if (!id || unique.includes(id)) continue;
    if (id === ROOM_SECTIONS.GENERAL_RULES || ROOM_FOLDER_MAP[id]) {
      unique.push(id);
    }
  }

  if (unique.length === 0) {
    unique.push(ROOM_SECTIONS.GENERAL_RULES);
  } else if (!unique.includes(ROOM_SECTIONS.GENERAL_RULES)) {
    unique.unshift(ROOM_SECTIONS.GENERAL_RULES);
  }

  const liveOptions = {
    guestProfile: options.guestProfile || null,
    normalized: options.normalized || ''
  };

  return unique
    .map((id) => {
      if (id === ROOM_SECTIONS.GENERAL_RULES) return buildRoomGeneralRulesSection();
      if (id === ROOM_SECTIONS.COMFORT) {
        return buildLiveRoomSection('РАЗДЕЛ: КОМНАТА КОМФОРТ', id, liveOptions);
      }
      if (id === ROOM_SECTIONS.DELUXE_2) {
        return buildLiveRoomSection('РАЗДЕЛ: КОМНАТА ДЕЛЮКС 2 ЭТАЖ', id, liveOptions);
      }
      if (id === ROOM_SECTIONS.DELUXE_3) {
        return buildLiveRoomSection('РАЗДЕЛ: КОМНАТА ДЕЛЮКС 3 ЭТАЖ', id, liveOptions);
      }
      if (id === ROOM_SECTIONS.FAMILY) {
        return buildLiveRoomSection('РАЗДЕЛ: КОМНАТА СЕМЕЙНАЯ', id, liveOptions);
      }
      return '';
    })
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
    includesAny(normalized, ['2', 'втор']) && includesAny(normalized, ['3', 'трет']);
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

function wantsMoreSpace(normalized) {
  return includesAny(normalized, ['простор', 'побольше', 'семейн', 'две зоны', 'разделени']);
}

/** Family для 4 взрослых — только при явном запросе зон / доп. пространства. */
function wantsFamilyAsAlternative(normalized) {
  return (
    wantsMoreSpace(normalized) &&
    includesAny(normalized, ['две зоны', 'разделени', 'жилые зон', 'семейн', 'простор'])
  );
}

function hasPlacementBreakdown(profile) {
  return profile?.adults != null || profile?.children != null;
}

function needsFamilyCompositionBreakdown(profile, normalized = '') {
  const size = guestPartySize(profile, normalized);
  return size != null && size >= 5 && !hasPlacementBreakdown(profile);
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
    if (hasPlacementBreakdown(profile)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
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

  // Comfort-first: основной Comfort + один подходящий Deluxe (второй этаж по умолчанию;
  // 3 этаж — при запросе большого балкона). Family — только при явном запросе простора/зон.
  if (adults === 2 && children === 1) {
    selected.push(ROOM_SECTIONS.COMFORT);
    selected.push(largeBalcony ? ROOM_SECTIONS.DELUXE_3 : ROOM_SECTIONS.DELUXE_2);
    if (wantsMoreSpace(normalized)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (size === 4 && !cot) {
    const fourAdultsOnly =
      adults === 4 && (children === 0 || children == null);
    selected.push(ROOM_SECTIONS.DELUXE_2, ROOM_SECTIONS.DELUXE_3);
    if (!fourAdultsOnly) {
      selected.push(ROOM_SECTIONS.FAMILY);
    } else if (wantsFamilyAsAlternative(normalized)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (size === 3 && !cot) {
    selected.push(ROOM_SECTIONS.COMFORT);
    selected.push(largeBalcony ? ROOM_SECTIONS.DELUXE_3 : ROOM_SECTIONS.DELUXE_2);
    if (wantsMoreSpace(normalized)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (adults === 3) {
    selected.push(ROOM_SECTIONS.COMFORT);
    selected.push(largeBalcony ? ROOM_SECTIONS.DELUXE_3 : ROOM_SECTIONS.DELUXE_2);
    if (wantsMoreSpace(normalized)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (friends && (size == null || size >= 4)) {
    selected.push(ROOM_SECTIONS.FAMILY);
    return selected;
  }

  if (family && (children == null || children >= 1) && size == null) {
    selected.push(ROOM_SECTIONS.COMFORT, ROOM_SECTIONS.DELUXE_2);
    if (wantsMoreSpace(normalized)) {
      selected.push(ROOM_SECTIONS.FAMILY);
    }
    return selected;
  }

  if (size === 2) {
    selected.push(ROOM_SECTIONS.COMFORT, ROOM_SECTIONS.DELUXE_2);
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
  const profile = profileForRouting(guestProfile, normalized);

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
  } else if (needsFamilyCompositionBreakdown(profile, normalized)) {
    selected = [];
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
    if (needsFamilyCompositionBreakdown(profile, normalized)) {
      selected = [ROOM_SECTIONS.GENERAL_RULES];
    } else {
      selected = [...LOW_CONFIDENCE_ROOM_SECTIONS];
    }
  }

  return uniqueSections(selected);
}
