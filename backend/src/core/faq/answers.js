import { includesAny, isComplexRequest } from '../text-normalize.js';

/**
 * FAQ только из подтверждённых фактов живого бота.
 * Не добавлять intent, если в базе нет однозначного ответа.
 *
 * Типы знаний (логическая метка, без отдельного хранилища):
 * PUBLIC — можно использовать самостоятельно.
 * CONTEXTUAL — по вопросу/ситуации гостя.
 * ON_REQUEST_ONLY — только при прямом вопросе.
 */
export const FAQ_INTENTS = [
  {
    id: 'children_pool',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/pool/description.txt',
      'backend/policies/objections.txt'
    ],
    match(normalized) {
      return (
        normalized.includes('бассейн') &&
        includesAny(normalized, ['дет', 'ребен', 'малыш'])
      );
    },
    text: [
      'Дети могут находиться у бассейна и пользоваться бассейном только под присмотром взрослых.',
      'Спасателя на территории нет, бассейн относится к зоне повышенной осторожности: глубина от 1,10 до 1,70 м.'
    ].join(' ')
  },
  {
    id: 'pool',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/pool/description.txt',
      'backend/property/pool/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return normalized.includes('бассейн');
    },
    text: [
      'На территории есть подогреваемый бассейн 8,6 × 3,7 м, глубина от 1,10 до 1,70 м.',
      'Пользоваться бассейном можно с 09:00 до 21:00, это входит в проживание без дополнительной оплаты.',
      'Спасателя на территории нет; дети могут быть у бассейна и пользоваться бассейном только под присмотром взрослых.'
    ].join(' ')
  },
  {
    id: 'check_in_out',
    knowledgeType: 'PUBLIC',
    source: ['backend/src/systemPrompt.js', 'backend/policies/booking_rules.txt'],
    match(normalized) {
      const timeOrFlexibility = includesAny(normalized, [
        'во сколько',
        'время',
        'со скольки',
        'до скольки',
        'ранн',
        'поздн',
        'раньше',
        'позже',
        'пораньше',
        'попозже'
      ]);
      const checkInOut = includesAny(normalized, [
        'заезд',
        'выезд',
        'заселен',
        'заселить',
        'заселя',
        'приехать',
        'выехать'
      ]);
      return timeOrFlexibility && checkInOut;
    },
    text: [
      'Заезд — с 15:00, выезд — до 12:00.',
      'Если нужен ранний заезд или поздний выезд, возможность можно уточнить индивидуально — она зависит от занятости комнаты на ваши даты.'
    ].join(' ')
  },
  {
    id: 'barbecue_area',
    knowledgeType: 'ON_REQUEST_ONLY',
    source: ['backend/src/systemPrompt.js', 'backend/policies/general_rules.txt'],
    match(normalized) {
      return includesAny(normalized, [
        'мангал',
        'шашлык',
        'шашлыч',
        'барбекю',
        'барбекю',
        'гриль'
      ]);
    },
    text: [
      'Да, у нас есть мангальная зона, и гости могут ею воспользоваться, если на этот период не действуют ограничения местных властей на использование открытого огня.'
    ].join(' ')
  },
  {
    id: 'quiet_hours',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/pool/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return includesAny(normalized, [
        'тишин',
        'тихие часы',
        'не шуметь',
        'шуметь',
        'шум',
        'музык'
      ]);
    },
    text: [
      'Мы бережём спокойный отдых гостей, поэтому с 23:00 до 08:00 просим соблюдать тишину.',
      'Музыка у бассейна звучит до 23:00.',
      'Это не ограничивает вход и выход с территории: гости могут свободно заходить и выходить в любое время суток.'
    ].join(' ')
  },
  {
    id: 'cooking',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/terrace/description.txt',
      'backend/property/terrace/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return includesAny(normalized, [
        'готовить',
        'приготов',
        'кухн',
        'плит',
        'мультивар',
        'чайник',
        'нагревательн'
      ]);
    },
    text: [
      'На террасе можно удобно разогреть готовую еду, сервировать стол, сделать чай или кофе; отсутствие зоны активного приготовления помогает сохранять спокойную атмосферу без запахов готовки.',
      'Плиты нет, полноценное самостоятельное приготовление пищи гостями не предусмотрено.',
      'Собственные мультиварки, плитки, чайники и другая нагревательная техника в комнатах не используются: для разогрева и приёма пищи оборудована терраса.'
    ].join(' ')
  },
  {
    id: 'meals_in_rooms',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/policies/objections.txt',
      'backend/property/terrace/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      // Нельзя матчить голое «есть» + «в номере»: «фен в номере есть?» —
      // это вопрос о наличии вещи, а не о приёме пищи.
      return (
        includesAny(normalized, [
          'есть в номер',
          'есть в комнат',
          'кушать в номер',
          'кушать в комнат',
          'покушать в номер',
          'покушать в комнат',
          'поесть в номер',
          'поесть в комнат',
          'принимать пищ',
          'прием пищ',
          'питаться в'
        ]) ||
        (includesAny(normalized, ['кушать', 'покушать', 'поесть']) &&
          includesAny(normalized, ['в номер', 'в комнат']))
      );
    },
    text: [
      'Для приёма пищи предусмотрена отдельная оборудованная терраса.',
      'Благодаря этому комнаты остаются пространством для отдыха — чистым, свежим и без запахов еды.'
    ].join(' ')
  },
  {
    id: 'food_service',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/src/systemPrompt.js',
      'backend/property/terrace/description.txt',
      'backend/policies/general_rules.txt'
    ],
    match(normalized) {
      return includesAny(normalized, [
        'питание',
        'завтрак',
        'обед',
        'ужин',
        'кормите',
        'кормлени'
      ]);
    },
    text: [
      'Питание гостевой дом не предоставляет.',
      'На террасе можно удобно разогреть готовую еду, сервировать стол, сделать чай или кофе: есть микроволновая печь, термопот с кипятком, холодильник, вода и посуда.'
    ].join(' ')
  },
  {
    id: 'baby_cot_deluxe_full',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/rooms/deluxe_2floor/description.txt',
      'backend/rooms/deluxe_3floor/description.txt',
      'backend/rooms/family_room/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      const wantsCot = includesAny(normalized, ['детская кроватка', 'кроватка']);
      const deluxe = normalized.includes('делюкс');
      const fourGuests = includesAny(normalized, [
        '4 гост',
        'четыре гост',
        'четверо',
        'четверым',
        'на четверых',
        'нас четверо',
        'нас 4'
      ]);
      return wantsCot && deluxe && fourGuests;
    },
    text: [
      'В «Делюкс» при размещении 4 гостей детскую кроватку не устанавливаем.',
      'Если нужны 4 гостя и дополнительно детская кроватка, лучше подойдёт «Семейная» — там кроватку установить можно.',
      'Детская кроватка — для ребёнка до 4 лет, по запросу, без дополнительной платы.'
    ].join(' ')
  },
  {
    id: 'baby_cot',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/rooms/comfort_2floor/description.txt',
      'backend/rooms/deluxe_2floor/description.txt',
      'backend/rooms/deluxe_3floor/description.txt',
      'backend/rooms/family_room/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return includesAny(normalized, ['детская кроватка', 'кроватка']);
    },
    text: [
      'Детская кроватка предоставляется по запросу для ребёнка до 4 лет и входит в стоимость.',
      'В «Комфорт» установить можно.',
      'В «Делюкс» при размещении 2 или 3 гостей установить можно; при размещении 4 гостей детскую кроватку не устанавливаем — тогда лучше подойдёт «Семейная».',
      'В «Семейной» кроватку установить можно.'
    ].join(' ')
  },
  {
    id: 'smoking',
    knowledgeType: 'PUBLIC',
    source: ['backend/policies/general_rules.txt', 'backend/src/systemPrompt.js'],
    match(normalized) {
      return includesAny(normalized, [
        'курить',
        'курение',
        'курите',
        'курящ',
        'сигарет'
      ]);
    },
    text: [
      'Чтобы в комнатах сохранялись свежесть и отсутствие запахов, курение в жилых помещениях не предусмотрено.',
      'Для этого есть специально отведённое место для курения.'
    ].join(' ')
  },
  {
    id: 'access_code',
    knowledgeType: 'PUBLIC',
    source: ['backend/policies/general_rules.txt', 'backend/src/systemPrompt.js'],
    match(normalized) {
      return (
        includesAny(normalized, [
          'код доступ',
          'код от калит',
          'калитка',
          'попасть на территори',
          'вход на территори',
          'круглосуточн',
          'ночью войти',
          'ночью выйти'
        ]) ||
        (normalized.includes('территор') &&
          includesAny(normalized, ['закрыт', 'код', 'доступ', 'калитка', 'войти', 'выйти']))
      );
    },
    text: [
      'Территория закрытая, вход осуществляется по коду.',
      'Проживающие гости могут входить и выходить круглосуточно, ограничений на вход и выход ночью нет.',
      'С 23:00 до 08:00 действует режим тишины, поэтому при позднем возвращении важно не мешать другим отдыхающим.'
    ].join(' ')
  },
  {
    id: 'cctv',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/policies/objections.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return includesAny(normalized, ['видеонаблюд', 'камер']);
    },
    text: [
      'Видеонаблюдение используется в целях безопасности гостей и территории и ведётся только в общих зонах.',
      'В комнатах и санузлах камер нет.'
    ].join(' ')
  },
  {
    id: 'minibus',
    knowledgeType: 'CONTEXTUAL',
    source: ['backend/src/systemPrompt.js', 'backend/property/location/description.txt'],
    match(normalized) {
      return includesAny(normalized, [
        'трансфер',
        'микроавтобус',
        'маршрутка',
        'автобус до пляж',
        'автобус до моря',
        'довезти до пляж',
        'довезти до моря'
      ]);
    },
    text: [
      'Это не трансфер гостевого дома «Отдых.23» и не услуга гостевого дома.',
      'Мимо дома проходит микроавтобус: ориентировочно каждые 30 минут, в пути примерно 3–5 минут в зависимости от дорожной ситуации, довозит непосредственно ко входу на пляж «Касабланка».',
      'Обратно можно уехать от пляжа практически до ворот «Отдых.23».',
      'Контакт водителя можно предоставить, чтобы уточнить ближайшее время поездки.',
      'Стоимость нужно уточнить непосредственно у водителя.'
    ].join(' ')
  },
  {
    id: 'sea_distance',
    knowledgeType: 'PUBLIC',
    source: ['backend/src/systemPrompt.js', 'backend/property/location/description.txt'],
    match(normalized) {
      return includesAny(normalized, [
        'до моря',
        'к морю',
        'далеко ли море',
        'сколько до моря',
        'как до моря',
        'пешком до моря',
        'море далеко',
        'расстояние до моря',
        'путь до моря',
        'далеко до моря'
      ]);
    },
    text: [
      'До моря пешком примерно 15–16 минут: это время от «Отдых.23» непосредственно до пляжа.',
      'Пешком можно выйти к пляжам «Багратион» и «Взморье».',
      'Пляжи оборудованные: есть инфраструктура, душевые, туалетные комнаты, точки питания и прокат.'
    ].join(' ')
  },
  {
    id: 'address',
    knowledgeType: 'PUBLIC',
    source: ['backend/src/systemPrompt.js'],
    match(normalized) {
      return includesAny(normalized, [
        'адрес',
        'где находи',
        'как проехать',
        'как добрать',
        'эвкалиптов'
      ]);
    },
    text: 'Гостевой дом «Отдых.23» находится по адресу: г. Сочи, п. Лазаревское, ул. Эвкалиптовая, 12. Сайт: https://otdyh23.ru/'
  },
  {
    id: 'phone',
    knowledgeType: 'PUBLIC',
    source: ['backend/src/systemPrompt.js'],
    match(normalized) {
      return includesAny(normalized, [
        'телефон',
        'номер телефона',
        'позвонить',
        'ваш контакт'
      ]);
    },
    text: 'Связаться с администратором Оксаной можно по телефону: +7 918 31 500 31.'
  },
  {
    id: 'deluxe_large_balcony',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/src/systemPrompt.js',
      'backend/rooms/deluxe_3floor/description.txt'
    ],
    match(normalized) {
      if (!normalized.includes('балкон')) return false;
      return includesAny(normalized, [
        'больш',
        'простор',
        'посидеть',
        'сидеть',
        'мебел'
      ]);
    },
    text: [
      'Если важен большой балкон, возможность посидеть на воздухе и уличная мебель, лучше подойдёт «Делюкс» на 3 этаже.',
      'По наполнению «Делюкс» на 2 и 3 этаже одинаковые: на 2 этаже — небольшой французский балкон, на 3 этаже — большой балкон с уличной мебелью.',
      'Подходящий вариант по числу гостей подберём отдельно.'
    ].join(' ')
  },
  {
    id: 'deluxe_difference',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/src/systemPrompt.js',
      'backend/rooms/deluxe_2floor/description.txt',
      'backend/rooms/deluxe_3floor/description.txt'
    ],
    match(normalized) {
      const hasDeluxe = normalized.includes('делюкс');
      const hasCompare = includesAny(normalized, [
        'отлича',
        'разниц',
        'отличие',
        'чем отлича'
      ]);
      const hasTwoFloors =
        (normalized.includes('2') || includesAny(normalized, ['втор', 'второго'])) &&
        (normalized.includes('3') || includesAny(normalized, ['трет', 'третьего']));
      return (hasDeluxe && hasCompare) || (hasDeluxe && hasTwoFloors && (hasCompare || normalized.includes('балкон')));
    },
    text: [
      'По наполнению, мебели, спальным местам и комплектации «Делюкс» на 2 и 3 этаже идентичны.',
      'Основное различие: на 2 этаже — небольшой французский балкон, на 3 этаже — большой балкон с уличной мебелью.'
    ].join(' ')
  }
];

export function matchFaq(normalized) {
  if (!normalized || isComplexRequest(normalized)) return null;

  for (const intent of FAQ_INTENTS) {
    if (intent.match(normalized)) {
      return {
        handled: true,
        type: 'faq',
        text: intent.text,
        data: { intent: intent.id, knowledgeType: intent.knowledgeType }
      };
    }
  }

  return null;
}

export function mentionsBarbecue(text) {
  return /мангал|шашлык|барбекю|гриль/i.test(String(text || ''));
}

export function getPublicTerritoryFacts() {
  const pool = FAQ_INTENTS.find((item) => item.id === 'pool');
  const quiet = FAQ_INTENTS.find((item) => item.id === 'quiet_hours');
  const cooking = FAQ_INTENTS.find((item) => item.id === 'cooking');
  return [pool?.text, quiet?.text, cooking?.text].filter(Boolean).join(' ');
}
