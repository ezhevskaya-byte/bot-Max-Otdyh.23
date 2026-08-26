import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { routeMessage, routeThenMaybeAskAI } from '../src/core/router.js';
import { complete } from '../src/core/ai/provider.js';
import { FAQ_INTENTS, getPublicTerritoryFacts, mentionsBarbecue } from '../src/core/faq/answers.js';
import { SYSTEM_PROMPT } from '../src/systemPrompt.js';
import { buildRoomSelectionHint } from '../src/room-sales-logic.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOM_CASES = [
  {
    name: 'comfort-2',
    userText: 'покажите фото комфорт',
    lastAssistantText: 'Для двоих хорошо подойдёт комната Комфорт.',
    room_id: 'comfort',
    scenario_id: 'comfort-2',
    url: 'https://otdyh23.ru/?room=comfort&scenario=comfort-2#rooms'
  },
  {
    name: 'comfort-3',
    userText: 'покажите фото комфорт для троих',
    lastAssistantText: 'Для 3 гостей можно рассмотреть Комфорт.',
    room_id: 'comfort',
    scenario_id: 'comfort-3',
    url: 'https://otdyh23.ru/?room=comfort&scenario=comfort-3#rooms'
  },
  {
    name: 'comfort-cot',
    userText: 'покажите фото комфорт с детской кроваткой',
    lastAssistantText: 'Для семьи с малышом в Комфорт можно поставить кроватку.',
    room_id: 'comfort',
    scenario_id: 'comfort-cot',
    url: 'https://otdyh23.ru/?room=comfort&scenario=comfort-cot#rooms'
  },
  {
    name: 'deluxe-2 / 2-3-guests',
    userText: 'покажите фото делюкс 2 этаж',
    lastAssistantText: 'Для двоих подойдёт Делюкс 2 этаж.',
    room_id: 'deluxe-2',
    scenario_id: '2-3-guests',
    url: 'https://otdyh23.ru/?room=deluxe-2&scenario=2-3-guests#rooms'
  },
  {
    name: 'deluxe-2 / 4-guests',
    userText: 'покажите фото делюкс 2 этаж на 4 гостей',
    lastAssistantText: 'Для семьи до 4 гостей подойдёт Делюкс 2 этаж.',
    room_id: 'deluxe-2',
    scenario_id: '4-guests',
    url: 'https://otdyh23.ru/?room=deluxe-2&scenario=4-guests#rooms'
  },
  {
    name: 'deluxe-3 / 2-3-guests',
    userText: 'покажите фото делюкс 3 этаж',
    lastAssistantText: 'Для двоих подойдёт Делюкс 3 этаж.',
    room_id: 'deluxe-3',
    scenario_id: '2-3-guests',
    url: 'https://otdyh23.ru/?room=deluxe-3&scenario=2-3-guests#rooms'
  },
  {
    name: 'deluxe-3 / 4-guests',
    userText: 'покажите фото делюкс 3 этаж на четыре гостя',
    lastAssistantText: 'Для семьи до 4 гостей подойдёт Делюкс 3 этаж.',
    room_id: 'deluxe-3',
    scenario_id: '4-guests',
    url: 'https://otdyh23.ru/?room=deluxe-3&scenario=4-guests#rooms'
  },
  {
    name: 'family / 2-guests',
    userText: 'покажите фото семейный',
    lastAssistantText: 'Для двоих можно рассмотреть Семейную комнату.',
    room_id: 'family',
    scenario_id: '2-guests',
    url: 'https://otdyh23.ru/?room=family&scenario=2-guests#rooms'
  },
  {
    name: 'family / 3-4-guests',
    userText: 'покажите фото семейный на 3 гостей',
    lastAssistantText: 'Для семьи из трёх человек подойдёт Семейная комната.',
    room_id: 'family',
    scenario_id: '3-4-guests',
    url: 'https://otdyh23.ru/?room=family&scenario=3-4-guests#rooms'
  },
  {
    name: 'family / 5-guests',
    userText: 'покажите фото семейный на 5 гостей',
    lastAssistantText: 'Для семьи до 5 гостей подойдёт Семейная комната.',
    room_id: 'family',
    scenario_id: '5-guests',
    url: 'https://otdyh23.ru/?room=family&scenario=5-guests#rooms'
  }
];

describe('router: room-link без LLM', () => {
  it('A. Покажи Комфорт для двоих → comfort-2', () => {
    const routed = routeMessage({ text: 'Покажи Комфорт для двоих' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'room-link');
    assert.equal(routed.data.scenario_id, 'comfort-2');
    assert.equal(
      routed.data.url,
      'https://otdyh23.ru/?room=comfort&scenario=comfort-2#rooms'
    );
  });

  it('B. Покажи Комфорт для троих → comfort-3', () => {
    const routed = routeMessage({ text: 'Покажи Комфорт для троих' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'room-link');
    assert.equal(routed.data.scenario_id, 'comfort-3');
    assert.equal(
      routed.data.url,
      'https://otdyh23.ru/?room=comfort&scenario=comfort-3#rooms'
    );
  });

  for (const dialog of ROOM_CASES) {
    it(`сохраняет ссылку ${dialog.name}`, () => {
      const routed = routeMessage({
        text: dialog.userText,
        context: { lastAssistantText: dialog.lastAssistantText }
      });

      assert.equal(routed.handled, true);
      assert.equal(routed.type, 'room-link');
      assert.equal(routed.data.room_id, dialog.room_id);
      assert.equal(routed.data.scenario_id, dialog.scenario_id);
      assert.equal(routed.data.url, dialog.url);
    });
  }
});

describe('router: FAQ без LLM', () => {
  it('D. Можно готовить в номере? → cooking', () => {
    const routed = routeMessage({ text: 'Можно готовить в номере?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'cooking');
    assert.match(routed.text, /плиты нет/i);
    assert.match(routed.text, /терраса/i);
    assert.doesNotMatch(routed.text, /общей кухн/i);
  });

  it('варианты вопроса про готовку попадают в один intent', () => {
    const variants = [
      'можно готовить?',
      'есть кухня?',
      'есть плита?',
      'можно самим приготовить?'
    ];

    for (const text of variants) {
      const routed = routeMessage({ text });
      assert.equal(routed.type, 'faq', text);
      assert.equal(routed.data.intent, 'cooking', text);
    }
  });

  it('E. Во сколько нужно соблюдать тишину? → quiet_hours', () => {
    const routed = routeMessage({ text: 'Во сколько нужно соблюдать тишину?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'quiet_hours');
    assert.match(routed.text, /23:00/);
  });

  it('F. Есть детская кроватка? → baby_cot', () => {
    const routed = routeMessage({ text: 'Есть детская кроватка?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'baby_cot');
    assert.match(routed.text, /4 лет/);
  });

  it('G. Что у вас с бассейном? → pool', () => {
    const routed = routeMessage({ text: 'Что у вас с бассейном?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'pool');
    assert.match(routed.text, /8,6/);
    assert.match(routed.text, /09:00 до 21:00/);
    assert.match(routed.text, /подогреваем/i);
    assert.doesNotMatch(routed.text, /бассейн работает/i);
    assert.doesNotMatch(routed.text, /режим работы бассейна/i);
  });
});

describe('router: AI fallback', () => {
  it('C. Нужна комната с большим балконом → Делюкс 3 этаж без LLM', () => {
    const routed = routeMessage({ text: 'Нужна комната с большим балконом' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'deluxe_large_balcony');
    assert.match(routed.text, /Делюкс/i);
    assert.match(routed.text, /3 этаж/i);
  });

  it('H. сложный семейный вопрос → AI fallback', () => {
    const routed = routeMessage({
      text: 'Мы едем с бабушкой и двумя детьми, хотим разместиться удобно и чтобы был хороший балкон. Что посоветуете?'
    });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });

  it('I. неизвестный вопрос → AI fallback', () => {
    const routed = routeMessage({ text: 'Можно ли привезти синтезатор и репетировать вечером?' });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });
});

describe('router: provider не вызывается на FAQ и room-link', () => {
  let originalFetch;
  let fetchCalls;
  let askAICalls;

  beforeEach(() => {
    fetchCalls = [];
    askAICalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'LLM answer' } }]
        })
      };
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function run(text) {
    return routeThenMaybeAskAI({
      text,
      askAI: async (userText) => {
        askAICalls.push(userText);
        return complete({
          system: 'sys',
          messages: [{ role: 'user', content: userText }],
          temperature: 0.15
        });
      }
    });
  }

  it('J. FAQ не вызывает provider', async () => {
    const result = await run('Можно готовить в номере?');
    assert.equal(result.handled, true);
    assert.equal(result.type, 'faq');
    assert.equal(askAICalls.length, 0);
    assert.equal(fetchCalls.length, 0);
  });

  it('J. room-link не вызывает provider', async () => {
    const result = await run('Покажи Комфорт для двоих');
    assert.equal(result.handled, true);
    assert.equal(result.type, 'room-link');
    assert.equal(askAICalls.length, 0);
    assert.equal(fetchCalls.length, 0);
  });

  it('AI fallback вызывает askAI/provider', async () => {
    process.env.AI_API_KEY = process.env.AI_API_KEY || 'test-key';
    const result = await run('Можно ли привезти синтезатор и репетировать вечером?');
    assert.equal(result.handled, false);
    assert.equal(result.type, 'ai');
    assert.equal(askAICalls.length, 1);
    assert.equal(fetchCalls.length, 1);
    assert.match(String(fetchCalls[0].url), /chat\/completions/);
  });
});

describe('STAGE 2.6: канонические FAQ без LLM', () => {
  it('1. Во сколько заезд? → check_in_out, с 15:00', () => {
    const routed = routeMessage({ text: 'Во сколько заезд?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'check_in_out');
    assert.match(routed.text, /15:00/);
  });

  it('2. Во сколько выезд? → check_in_out, до 12:00', () => {
    const routed = routeMessage({ text: 'Во сколько выезд?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'check_in_out');
    assert.match(routed.text, /12:00/);
  });

  it('3. Можно приехать раньше? → без обещания, по согласованию', () => {
    const routed = routeMessage({ text: 'Можно приехать раньше?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'check_in_out');
    assert.match(routed.text, /15:00/);
    assert.match(routed.text, /уточнить индивидуально|занятости комнаты/i);
    assert.doesNotMatch(routed.text, /конечно можно|гарантир|обязательно получится/i);
  });

  it('4. Есть мангал? → barbecue_area, с оговоркой про открытый огонь', () => {
    const routed = routeMessage({ text: 'Есть мангал?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'barbecue_area');
    assert.match(routed.text, /мангальн/i);
    assert.match(routed.text, /открытого огня/i);
  });

  it('5. Стандартный рассказ о территории не рекламирует мангал', () => {
    const territory = routeMessage({ text: 'Расскажите про территорию' });
    assert.notEqual(territory.data?.intent, 'barbecue_area');
    assert.equal(mentionsBarbecue(getPublicTerritoryFacts()), false);
    for (const id of ['pool', 'quiet_hours', 'cooking', 'food_service', 'access_code']) {
      const intent = FAQ_INTENTS.find((item) => item.id === id);
      assert.equal(mentionsBarbecue(intent.text), false, id);
    }
  });

  it('6. До моря далеко? → 15–16 минут пешком', () => {
    const routed = routeMessage({ text: 'До моря далеко?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'sea_distance');
    assert.match(routed.text, /15–16|15-16/);
    assert.doesNotMatch(routed.text, /10–15|10-15/);
  });

  it('7. Есть трансфер? → не трансфер «Отдых.23»', () => {
    const routed = routeMessage({ text: 'Есть трансфер?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'minibus');
    assert.match(routed.text, /не трансфер гостевого дома/i);
    assert.match(routed.text, /микроавтобус/i);
    assert.doesNotMatch(routed.text, /у нас есть трансфер/i);
  });

  it('8. Нужен большой балкон → Делюкс 3 этаж', () => {
    const routed = routeMessage({ text: 'Нужен большой балкон' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'deluxe_large_balcony');
    assert.match(routed.text, /Делюкс/i);
    assert.match(routed.text, /3 этаж/i);
  });

  it('9. Нас пятеро, семья → база допускает Семейную до 5', () => {
    const routed = routeMessage({ text: 'Нас пятеро, семья' });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
    const familyRoom = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../rooms/family_room/room.json'),
        'utf-8'
      )
    );
    assert.equal(familyRoom.capacity.max, 5);
    assert.match(SYSTEM_PROMPT, /вместимость — до 5 гостей/i);
    assert.doesNotMatch(SYSTEM_PROMPT, /Семейная — максимум 4/i);
    const hint = buildRoomSelectionHint('Нас пятеро, семья');
    assert.match(hint, /до 5 гостей/i);
  });

  it('10. Нас пятеро взрослых друзей → не запрещать Семейную, можно две комнаты', () => {
    const routed = routeMessage({ text: 'Нас пятеро взрослых друзей' });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
    assert.doesNotMatch(SYSTEM_PROMPT, /Для 5 взрослых не предлагать/i);
    const hint = buildRoomSelectionHint('Нас пятеро взрослых друзей');
    assert.match(hint, /не утверждать/i);
    assert.match(hint, /две комнаты/i);
  });

  it('11. Четверо и кроватка в Делюкс → Семейная, не Делюкс 4 + кроватка', () => {
    const routed = routeMessage({
      text: 'Нас четверо и нужна ещё детская кроватка в Делюкс'
    });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'baby_cot_deluxe_full');
    assert.match(routed.text, /Семейная/i);
    assert.doesNotMatch(routed.text, /можно поставить кроватку в «Делюкс» при 4/i);
    const hint = buildRoomSelectionHint(
      'Нас четверо и нужна ещё детская кроватка в Делюкс'
    );
    assert.match(hint, /не предлагать конфигурацию/i);
  });

  it('12. Можно пользоваться бассейном вечером? → до 21:00, без «бассейн работает»', () => {
    const routed = routeMessage({ text: 'Можно пользоваться бассейном вечером?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'pool');
    assert.match(routed.text, /21:00/);
    assert.match(routed.text, /Пользоваться бассейном можно/i);
    assert.doesNotMatch(routed.text, /бассейн работает/i);
  });

  it('13. Адрес: г. Сочи, п. Лазаревское, ул. Эвкалиптовая, 12', () => {
    const routed = routeMessage({ text: 'Какой у вас адрес?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'address');
    assert.match(routed.text, /г\. Сочи/);
    assert.match(routed.text, /Лазаревское/);
    assert.match(routed.text, /Эвкалиптовая, 12/);
  });

  it('14. Канонический сайт https://otdyh23.ru/', () => {
    const routed = routeMessage({ text: 'Какой у вас адрес?' });
    assert.match(routed.text, /https:\/\/otdyh23\.ru\//);
    assert.doesNotMatch(routed.text, /otdyh-23\.clients\.site/);
    assert.match(SYSTEM_PROMPT, /https:\/\/otdyh23\.ru\//);
    assert.doesNotMatch(SYSTEM_PROMPT, /otdyh-23\.clients\.site/);
  });

  it('check_in_out и barbecue_area не вызывают provider', async () => {
    let askAICalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('provider must not be called');
    };
    try {
      for (const text of ['Во сколько заезд?', 'Есть мангал?']) {
        const result = await routeThenMaybeAskAI({
          text,
          askAI: async () => {
            askAICalls += 1;
            return 'LLM';
          }
        });
        assert.equal(result.handled, true, text);
        assert.equal(result.type, 'faq', text);
      }
      assert.equal(askAICalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

