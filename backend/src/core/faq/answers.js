import { includesAny, isComplexRequest } from '../text-normalize.js';
import { hasRoomSelectionContext } from '../guest-context/composition-gate.js';

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
    id: 'pool_payment',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/pool/description.txt',
      'backend/property/pool/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      if (!normalized.includes('бассейн')) return false;
      return includesAny(normalized, [
        'платн',
        'бесплат',
        'доплат',
        'входит в стоимость',
        'входит в проживание',
        'стоимость проживания',
        'без дополнительной оплаты',
        'доплачивать'
      ]);
    },
    text: [
      'Бассейном могут пользоваться гости, проживающие в «Отдых.23», с 09:00 до 21:00.',
      'На территории есть подогреваемый бассейн с современной системой очистки воды.'
    ].join(' ')
  },
  {
    id: 'pool_simple',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/pool/description.txt',
      'backend/property/pool/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      if (!normalized.includes('бассейн')) return false;
      if (
        includesAny(normalized, [
          'глубин',
          'размер',
          'спасател',
          'дет',
          'ребен',
          'малыш',
          'до скольк',
          'во скольк',
          'вечером',
          'утром',
          'утр',
          'правил',
          'безопас',
          'пользоваться',
          'подогрева',
          'платн',
          'бесплат',
          'доплат',
          'входит',
          'что у вас',
          'расскаж',
          'подроб'
        ])
      ) {
        return false;
      }
      return includesAny(normalized, ['есть', 'имеется', 'бывает']);
    },
    text: 'Да, у нас есть подогреваемый бассейн с современной системой очистки воды. Бассейном могут пользоваться гости, проживающие в «Отдых.23», с 09:00 до 21:00.'
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
      'Да, у нас есть подогреваемый бассейн с современной системой очистки воды.',
      'Бассейном могут пользоваться гости, проживающие в «Отдых.23», с 09:00 до 21:00.',
      'Размер 8,6 × 3,7 м, глубина от 1,10 до 1,70 м.',
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
    id: 'quiet_hours_music',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/pool/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      if (!normalized.includes('музык')) return false;
      return includesAny(normalized, [
        'до 12',
        'до полуноч',
        'до 00',
        'после 23',
        'вечером',
        'негромк',
        'можно',
        'можем',
        'разреш'
      ]);
    },
    text(normalized) {
      if (normalized.includes('негромк')) {
        return 'После 23:00 необходимо соблюдать тишину, поэтому музыка в это время не допускается даже негромко.';
      }
      return 'После 23:00 необходимо соблюдать тишину, поэтому включать музыку в это время нельзя.';
    }
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
    text: 'Мы бережём спокойный отдых гостей, поэтому с 23:00 до 08:00 просим соблюдать тишину.'
  },
  {
    id: 'room_refrigerator',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/rooms/comfort_2floor/description.txt',
      'backend/property/terrace/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      if (normalized.includes('холодильник')) return true;
      return (
        includesAny(normalized, ['где', 'куда']) && normalized.includes('продукт')
      );
    },
    text(normalized) {
      const productsInRoomFridge =
        normalized.includes('продукт') &&
        normalized.includes('холодильник') &&
        includesAny(normalized, ['номер', 'комнат', 'мини', 'положить', 'можно', 'можем']);

      const whereStoreProducts =
        includesAny(normalized, ['где', 'куда']) && normalized.includes('продукт');

      if (productsInRoomFridge) {
        return 'Мини-холодильник в комнате небольшой и прежде всего удобен для охлаждения напитков. Для хранения продуктов мы рекомендуем пользоваться холодильниками на общей террасе.';
      }
      if (whereStoreProducts) {
        return 'Для хранения продуктов на общей террасе есть холодильники, которыми могут пользоваться гости — всё необходимое для приёма пищи находится рядом.';
      }
      const roomFridgeBase =
        'В комнатах установлены небольшие мини-холодильники — удобно охладить напитки. Для хранения продуктов на общей террасе есть холодильники, которыми могут пользоваться гости.';
      if (includesAny(normalized, ['больш', 'объем', 'объём', 'крупн'])) {
        return roomFridgeBase;
      }
      return 'Да, в каждой комнате есть небольшой мини-холодильник — удобно охладить напитки. Для хранения продуктов на общей террасе есть холодильники, которыми могут пользоваться гости.';
    }
  },
  {
    id: 'own_kettle',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/terrace/description.txt',
      'backend/property/terrace/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return (
        normalized.includes('чайник') &&
        includesAny(normalized, ['свой', 'собствен', 'принести', 'в номер', 'в комнат'])
      );
    },
    text: 'Чай или кофе можно удобно приготовить на общей террасе — там есть термопот с горячей водой. В номерах мы не используем собственные чайники и нагревательную технику.'
  },
  {
    id: 'tea_in_room',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/terrace/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      if (
        normalized.includes('чайник') &&
        includesAny(normalized, ['свой', 'собствен', 'принести'])
      ) {
        return false;
      }
      return (
        includesAny(normalized, ['чай', 'кофе']) &&
        includesAny(normalized, ['номер', 'комнат', 'сделать'])
      );
    },
    text: 'Чай или кофе можно приготовить на общей террасе — там есть термопот с горячей водой.'
  },
  {
    id: 'microwave',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/terrace/description.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return (
        normalized.includes('микроволнов') ||
        (includesAny(normalized, ['разогрет', 'подогрет']) &&
          includesAny(normalized, ['ед', 'пищ', 'готов', 'обед', 'ужин', 'завтрак'])) ||
        includesAny(normalized, ['где разогрет', 'где подогрет'])
      );
    },
    text: 'Конечно, на общей террасе есть микроволновка — там можно разогреть готовую еду и удобно поесть.'
  },
  {
    id: 'kitchen',
    knowledgeType: 'PUBLIC',
    source: [
      'backend/policies/general_rules.txt',
      'backend/property/terrace/description.txt',
      'backend/property/terrace/scenarios.txt',
      'backend/src/systemPrompt.js'
    ],
    match(normalized) {
      return normalized.includes('кухн');
    },
    text: 'На общей террасе есть всё необходимое для комфортного приёма пищи: можно разогреть готовую еду, сделать чай или кофе и удобно поесть.'
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
        (includesAny(normalized, ['кушать', 'покушать', 'поесть', 'есть']) &&
          includesAny(normalized, ['в номер', 'в комнат']) &&
          !includesAny(normalized, [
            'фен',
            'телевизор',
            'холодильник',
            'сейф',
            'кондиционер',
            'балкон',
            'wi-fi',
            'wifi',
            'чайник'
          ]))
      );
    },
    text: 'Для приёма пищи у нас предусмотрена общая терраса — там удобно поесть, разогреть готовую еду или сделать чай. В комнатах мы просим пищу не принимать.'
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
        'плит',
        'мультивар',
        'нагревательн'
      ]);
    },
    text: [
      'Плиты нет, полноценное самостоятельное приготовление пищи гостями не предусмотрено.',
      'На общей террасе можно разогреть готовую еду и сделать чай или кофе.'
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
      'На общей террасе можно разогреть готовую еду, сделать чай или кофе и удобно поесть.'
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
      if (!includesAny(normalized, ['детская кроватка', 'кроватк'])) return false;
      if (hasRoomSelectionContext(normalized)) return false;
      return true;
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
      const text =
        typeof intent.text === 'function' ? intent.text(normalized) : intent.text;
      return {
        handled: true,
        type: 'faq',
        text,
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
