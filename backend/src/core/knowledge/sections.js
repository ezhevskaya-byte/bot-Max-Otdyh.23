import {
  KNOWLEDGE_FILES,
  joinSections,
  sliceByHeading,
  stripBarbecueLines
} from './loader.js';
import {
  ROOM_SECTIONS,
  buildRoomSectionsContext,
  buildFullRoomsTopicSection,
  LOW_CONFIDENCE_ROOM_SECTIONS
} from './rooms.js';

export const TOPICS = {
  ROOMS: 'rooms',
  BABY_COT: 'baby_cot',
  POOL: 'pool',
  TERRACE_FOOD: 'terrace_food',
  SEA_LOCATION: 'sea_location',
  HOUSE_RULES: 'house_rules',
  CHECKIN: 'checkin',
  SALES: 'sales',
  BARBECUE: 'barbecue',
  CONTACT: 'contact'
};

const GENERAL_STOP = [
  'ПРАВИЛО ПРОДАЮЩЕЙ ПОДАЧИ ОГРАНИЧЕНИЙ',
  'ТИПЫ ЗНАНИЙ',
  'РЕЖИМ ТИШИНЫ',
  'БАССЕЙН',
  'ЗАЕЗД И ВЫЕЗД',
  'ПИТАНИЕ И ТЕРРАСА',
  'ЭЛЕКТРОПРИБОРЫ',
  'ГОСТИ И ПОСЕТИТЕЛИ',
  'КУРЕНИЕ',
  'ЖИВОТНЫЕ',
  'НЕСОВЕРШЕННОЛЕТНИЕ ГОСТИ',
  'ВИДЕОНАБЛЮДЕНИЕ',
  'МАНГАЛЬНАЯ ЗОНА',
  'ДЕТСКАЯ КРОВАТКА'
];

function general(heading) {
  return sliceByHeading(KNOWLEDGE_FILES.generalRules, heading, GENERAL_STOP);
}

function sales(heading, stops) {
  return sliceByHeading(KNOWLEDGE_FILES.salesRules, heading, stops);
}

export const SAFE_FALLBACK_TOPICS = [
  TOPICS.ROOMS,
  TOPICS.BABY_COT,
  TOPICS.POOL,
  TOPICS.TERRACE_FOOD,
  TOPICS.SEA_LOCATION,
  TOPICS.HOUSE_RULES,
  TOPICS.CHECKIN,
  TOPICS.SALES,
  TOPICS.CONTACT
];

function roomsSection(roomSections, options = {}) {
  return buildRoomSectionsContext(
    roomSections && roomSections.length ? roomSections : LOW_CONFIDENCE_ROOM_SECTIONS,
    options
  );
}

function babyCotSection() {
  return joinSections([
    'РАЗДЕЛ: ДЕТСКАЯ КРОВАТКА',
    general('ДЕТСКАЯ КРОВАТКА'),
    sliceByHeading(
      KNOWLEDGE_FILES.bookingRules,
      'ДЕТСКАЯ КРОВАТКА И ПОДБОР КОМНАТ',
      ['ЗАДАТОК', 'НЕВОЗВРАТНЫЙ ТАРИФ']
    ),
    'Подтверждённые правила:',
    '— детская кроватка для ребёнка до 4 лет, по запросу, без дополнительной платы;',
    '— в «Комфорт» установить можно;',
    '— в «Делюкс» при 2 или 3 гостях установить можно;',
    '— в «Делюкс» при размещении 4 гостей детскую кроватку НЕ устанавливаем;',
    '— не предлагать конфигурацию «Делюкс = 4 гостя + детская кроватка»;',
    '— если нужны 4 гостя и кроватка — рекомендовать «Семейную»;',
    '— в «Семейной» кроватку установить можно.'
  ]);
}

function poolSection() {
  return stripBarbecueLines(
    joinSections([
      'РАЗДЕЛ: БАССЕЙН',
      KNOWLEDGE_FILES.pool,
      general('БАССЕЙН'),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'БАССЕЙН И ДЕТИ', [
        'ПИТАНИЕ В КОМНАТАХ',
        'ЭЛЕКТРОПРИБОРЫ'
      ])
    ])
  );
}

function terraceFoodSection() {
  return stripBarbecueLines(
    joinSections([
      'РАЗДЕЛ: ТЕРРАСА И ПИТАНИЕ',
      KNOWLEDGE_FILES.terrace,
      general('ПИТАНИЕ И ТЕРРАСА'),
      general('ЭЛЕКТРОПРИБОРЫ'),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'ПИТАНИЕ В КОМНАТАХ', ['ЭЛЕКТРОПРИБОРЫ']),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'ЭЛЕКТРОПРИБОРЫ', ['ПОСТОРОННИЕ ГОСТИ'])
    ])
  );
}

function seaLocationSection() {
  return stripBarbecueLines(
    joinSections([
      'РАЗДЕЛ: РАСПОЛОЖЕНИЕ, МОРЕ, ДОРОГА',
      KNOWLEDGE_FILES.location
    ])
  );
}

function houseRulesSection() {
  return stripBarbecueLines(
    joinSections([
      'РАЗДЕЛ: ПРАВИЛА ДОМА',
      general('ОБЩИЕ ПРАВИЛА ГОСТЕВОГО ДОМА «ОТДЫХ.23»'),
      general('ПРАВИЛО ПРОДАЮЩЕЙ ПОДАЧИ ОГРАНИЧЕНИЙ'),
      general('РЕЖИМ ТИШИНЫ'),
      general('ГОСТИ И ПОСЕТИТЕЛИ'),
      general('КУРЕНИЕ'),
      general('ЖИВОТНЫЕ'),
      general('НЕСОВЕРШЕННОЛЕТНИЕ ГОСТИ'),
      general('ВИДЕОНАБЛЮДЕНИЕ'),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'ШУМ И РЕЖИМ ТИШИНЫ', ['БАССЕЙН И ДЕТИ']),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'ПОСТОРОННИЕ ГОСТИ', ['ВИДЕОНАБЛЮДЕНИЕ']),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'ВИДЕОНАБЛЮДЕНИЕ', ['ЖИВОТНЫЕ']),
      sliceByHeading(KNOWLEDGE_FILES.objections, 'ЖИВОТНЫЕ', ['5 ВЗРОСЛЫХ В ОДНОЙ КОМНАТЕ'])
    ])
  );
}

function checkinSection() {
  return joinSections([
    'РАЗДЕЛ: ЗАЕЗД И ВЫЕЗД',
    general('ЗАЕЗД И ВЫЕЗД'),
    sliceByHeading(KNOWLEDGE_FILES.bookingRules, 'ЗАЕЗД И ВЫЕЗД', [
      'ДЕТСКАЯ КРОВАТКА И ПОДБОР КОМНАТ'
    ])
  ]);
}

function salesSection() {
  // SALES_CORE уже задаёт поведение продавца; сюда — только лестница подбора без дублей стиля.
  return stripBarbecueLines(
    joinSections([
      'РАЗДЕЛ: ЛОГИКА ПОДБОРА КАТЕГОРИЙ',
      sales('ПРИОРИТЕТ ПОДБОРА КОМНАТ', ['ПРАВИЛА ПОДБОРА', 'КАК AI ДОЛЖЕН ОПИСЫВАТЬ КОМНАТЫ']),
      sales('ПРАВИЛА ПОДБОРА', ['КАК AI ДОЛЖЕН ОПИСЫВАТЬ КОМНАТЫ'])
    ])
  );
}

function barbecueSection() {
  return joinSections([
    'РАЗДЕЛ: МАНГАЛЬНАЯ ЗОНА — ON_REQUEST_ONLY',
    'Сообщать только потому, что гость сам спросил про мангал, шашлык, барбекю или открытый огонь.',
    'Не рекламировать самостоятельно и не обещать, что запрета местных властей сейчас нет, если это не проверено.',
    'Не фиксировать стоимость.',
    general('МАНГАЛЬНАЯ ЗОНА'),
    sliceByHeading(KNOWLEDGE_FILES.generalRules, 'МАНГАЛЬНАЯ ЗОНА — ON_REQUEST_ONLY', [
      'ДЕТСКАЯ КРОВАТКА'
    ])
  ]);
}

function contactSection() {
  return joinSections([
    'РАЗДЕЛ: КОНТАКТЫ',
    'Гостевой дом «Отдых.23».',
    'Адрес: г. Сочи, п. Лазаревское, ул. Эвкалиптовая, 12.',
    'Сайт: https://otdyh23.ru/',
    'Администратор Оксана, телефон: +7 918 31 500 31.',
    sliceByHeading(KNOWLEDGE_FILES.bookingRules, 'ПЕРЕВОД НА АДМИНИСТРАТОРА', ['СТИЛЬ ОБЩЕНИЯ'])
  ]);
}

const SECTION_BUILDERS = {
  [TOPICS.ROOMS]: roomsSection,
  [TOPICS.BABY_COT]: babyCotSection,
  [TOPICS.POOL]: poolSection,
  [TOPICS.TERRACE_FOOD]: terraceFoodSection,
  [TOPICS.SEA_LOCATION]: seaLocationSection,
  [TOPICS.HOUSE_RULES]: houseRulesSection,
  [TOPICS.CHECKIN]: checkinSection,
  [TOPICS.SALES]: salesSection,
  [TOPICS.BARBECUE]: barbecueSection,
  [TOPICS.CONTACT]: contactSection
};

export const TOPIC_SOURCES = {
  [TOPICS.ROOMS]: [
    'backend/rooms/* (только релевантные ROOM_* секции)',
    'ROOM_GENERAL_RULES',
    'prompts/sales-rules.txt (приоритет и правила подбора, кратко)'
  ],
  [TOPICS.BABY_COT]: [
    'backend/policies/general_rules.txt',
    'backend/policies/booking_rules.txt',
    'подтверждённые правила STAGE 2.6'
  ],
  [TOPICS.POOL]: [
    'backend/property/pool/*',
    'backend/policies/general_rules.txt',
    'backend/policies/objections.txt'
  ],
  [TOPICS.TERRACE_FOOD]: [
    'backend/property/terrace/*',
    'backend/policies/general_rules.txt',
    'backend/policies/objections.txt'
  ],
  [TOPICS.SEA_LOCATION]: ['backend/property/location/*'],
  [TOPICS.HOUSE_RULES]: [
    'backend/policies/general_rules.txt',
    'backend/policies/objections.txt'
  ],
  [TOPICS.CHECKIN]: [
    'backend/policies/general_rules.txt',
    'backend/policies/booking_rules.txt'
  ],
  [TOPICS.SALES]: [
    'prompts/sales-rules.txt',
    'backend/policies/communication_style.txt',
    'backend/policies/objections.txt'
  ],
  [TOPICS.BARBECUE]: ['backend/policies/general_rules.txt (только раздел мангала)'],
  [TOPICS.CONTACT]: [
    'канонические контакты STAGE 2.6',
    'backend/policies/booking_rules.txt'
  ]
};

export function buildTopicContext(
  topics,
  { roomSections, fullRooms = false, guestProfile = null, normalized = '' } = {}
) {
  const unique = [...new Set(topics)].filter((topic) => SECTION_BUILDERS[topic]);
  const roomOptions = { guestProfile, normalized };
  return unique
    .map((topic) => {
      if (topic === TOPICS.ROOMS) {
        if (fullRooms) return buildFullRoomsTopicSection();
        return SECTION_BUILDERS[topic](roomSections, roomOptions);
      }
      return SECTION_BUILDERS[topic]();
    })
    .filter((section) => section && section.trim())
    .join('\n\n-----------------------------\n\n');
}

export { ROOM_SECTIONS };
