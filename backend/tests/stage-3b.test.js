import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { routeMessage, routeThenMaybeAskAI } from '../src/core/router.js';
import { complete } from '../src/core/ai/provider.js';
import {
  retrieveKnowledge,
  prepareAiFallbackCall,
  buildLlmSystemPrompt,
  buildTopicContext,
  buildFullRoomsTopicSection,
  LLM_HISTORY_WINDOW,
  TOPICS,
  ROOM_SECTIONS
} from '../src/core/knowledge/index.js';
import { buildRoomSelectionHint } from '../src/room-sales-logic.js';
import {
  clearGuestContexts,
  extractGuestFacts,
  formatGuestProfileForLlm
} from '../src/core/guest-context/index.js';
import { HOUSE_RULES_TEXT } from '../src/core/commands.js';

function hasTopic(result, topic) {
  return result.topics.includes(topic);
}

function hasRoom(result, section) {
  return result.roomSections.includes(section);
}

function reductionPct(before, after) {
  return Math.round((1 - after / before) * 1000) / 10;
}

function measureStage3A(text, history = []) {
  const retrieved = retrieveKnowledge({
    text,
    conversationContext: { messages: history }
  });
  const knowledgeContext = buildTopicContext(retrieved.topics, { fullRooms: true });
  const system = buildLlmSystemPrompt({
    knowledgeContext,
    roomSelectionHint: buildRoomSelectionHint(text, history),
    guestProfileText: ''
  });
  const messages = [...history, { role: 'user', content: text }];
  const historyChars = messages.reduce(
    (sum, message) => sum + String(message?.content || '').length,
    0
  );
  return {
    knowledgeChars: knowledgeContext.length,
    systemChars: system.length,
    historyChars,
    totalApproxChars: system.length + historyChars,
    topics: retrieved.topics
  };
}

describe('STAGE 3B: каноническая формулировка бассейна', () => {
  it('11. клиентские ответы не используют «бассейн работает»', () => {
    assert.match(HOUSE_RULES_TEXT, /Пользоваться бассейном можно с 09:00 до 21:00/);
    assert.doesNotMatch(HOUSE_RULES_TEXT, /бассейн работает/i);

    const routed = routeMessage({ text: 'Какие правила дома?' });
    assert.equal(routed.handled, true);
    assert.match(routed.text, /Пользоваться бассейном можно с 09:00 до 21:00/);
    assert.doesNotMatch(routed.text, /бассейн работает/i);

    const pool = routeMessage({ text: 'Что у вас с бассейном?' });
    assert.equal(pool.handled, true);
    assert.doesNotMatch(pool.text, /бассейн работает/i);
  });
});

describe('STAGE 3B: точный room retrieval', () => {
  it('1. Расскажите про Комфорт → только ROOM_COMFORT + общие правила', () => {
    const result = retrieveKnowledge({ text: 'Расскажите про Комфорт' });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.COMFORT), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.GENERAL_RULES), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_2), false);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_3), false);
    assert.equal(hasRoom(result, ROOM_SECTIONS.FAMILY), false);
    assert.match(result.context, /comfort_2floor/);
    assert.match(result.context, /до 3 гостей/);
    assert.doesNotMatch(result.context, /deluxe_2floor/);
    assert.doesNotMatch(result.context, /deluxe_3floor/);
    assert.doesNotMatch(result.context, /family_room/);
  });

  it('2. Чем отличается Делюкс 2 от Делюкс 3? → оба Deluxe sections', () => {
    const result = retrieveKnowledge({
      text: 'Чем отличается Делюкс 2 от Делюкс 3?'
    });
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_2), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_3), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.GENERAL_RULES), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.COMFORT), false);
    assert.equal(hasRoom(result, ROOM_SECTIONS.FAMILY), false);
    assert.match(result.context, /deluxe_2floor/);
    assert.match(result.context, /deluxe_3floor/);
    assert.match(result.context, /небольшой французский балкон/i);
    assert.match(result.context, /большой балкон с уличной мебелью/i);
    assert.doesNotMatch(result.context, /comfort_2floor/);
    assert.doesNotMatch(result.context, /КОМНАТА: family_room/);
  });

  it('3. Нас пятеро, одна семья → FAMILY + general + sales, вместимость до 5', () => {
    const result = retrieveKnowledge({ text: 'Нас пятеро, одна семья' });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.SALES), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.FAMILY), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.GENERAL_RULES), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.COMFORT), false);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_2), false);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_3), false);
    assert.match(result.context, /до 5 гостей/i);
    assert.match(result.context, /family_room/);
    assert.doesNotMatch(result.context, /deluxe_2floor/);
  });

  it('4. Нас пятеро взрослых друзей → FAMILY/general/sales, две комнаты, нет запрета', () => {
    const result = retrieveKnowledge({ text: 'Нас пятеро взрослых друзей' });
    assert.equal(hasTopic(result, TOPICS.SALES), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.FAMILY), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.GENERAL_RULES), true);
    assert.match(result.context, /две комнаты/i);
    assert.match(result.context, /до 5 гостей/i);
    assert.doesNotMatch(result.context, /НЕ предлагается для 5 взрослых/i);
    assert.doesNotMatch(result.context, /максимум 4 гостя/i);
  });

  it('5. 2 взрослых + ребёнок 2 года, нужна кроватка → подходящие секции + BABY_COT', () => {
    const result = retrieveKnowledge({
      text: '2 взрослых + ребёнок 2 года, нужна кроватка'
    });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.BABY_COT), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.COMFORT), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.GENERAL_RULES), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_2), false);
    assert.equal(hasRoom(result, ROOM_SECTIONS.DELUXE_3), false);
    assert.match(result.context, /без дополнительной платы|входит в стоимость/i);
    assert.match(result.context, /до 4 лет/i);
    assert.match(result.context, /в «Комфорт» установить можно/i);
  });

  it('6. 4 гостя в Делюкс + нужна кроватка → Семейная, не Делюкс 4 + кроватка', () => {
    const result = retrieveKnowledge({
      text: '4 гостя в Делюкс + нужна кроватка'
    });
    assert.equal(hasTopic(result, TOPICS.BABY_COT), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.FAMILY), true);
    assert.equal(hasRoom(result, ROOM_SECTIONS.GENERAL_RULES), true);
    assert.match(result.context, /не устанавливаем/i);
    assert.match(result.context, /Семейную|Семейной/i);
    assert.match(result.context, /family_room/);
  });
});

describe('STAGE 3B: guest profile и history window', () => {
  beforeEach(() => {
    clearGuestContexts();
  });

  it('7. follow-up сохраняет состав в guest profile без полной старой истории', () => {
    const channel = 'max';
    const guestId = 'guest-followup-1';

    const first = prepareAiFallbackCall({
      text: 'Нас двое взрослых и ребёнок 3 года',
      channel,
      guestId
    });
    assert.equal(first.guestProfile.adults, 2);
    assert.equal(first.guestProfile.children, 1);
    assert.deepEqual(first.guestProfile.childrenAges, [3]);

    const second = prepareAiFallbackCall({
      text: 'А с большим балконом что лучше?',
      history: [
        { role: 'user', content: 'Нас двое взрослых и ребёнок 3 года' },
        { role: 'assistant', content: 'Для вашего состава хорошо подойдёт «Комфорт».' }
      ],
      channel,
      guestId
    });

    assert.equal(second.guestProfile.adults, 2);
    assert.equal(second.guestProfile.children, 1);
    assert.deepEqual(second.guestProfile.childrenAges, [3]);
    assert.equal(second.guestProfile.balconyPreference, 'large');
    assert.equal(hasRoom(second.retrieved, ROOM_SECTIONS.DELUXE_3), true);
    assert.match(second.system, /Взрослые: 2/);
    assert.match(second.system, /Дети: 1/);
    assert.match(second.system, /большой балкон/);
    assert.equal(second.messages.length <= LLM_HISTORY_WINDOW + 1, true);
  });

  it('8. неизвестный состав → система не выдумывает количество гостей', () => {
    const facts = extractGuestFacts('Расскажите про территорию и бассейн');
    assert.equal(facts.adults, null);
    assert.equal(facts.children, null);
    assert.equal(facts.partySize, null);
    assert.deepEqual(facts.childrenAges, []);

    const prepared = prepareAiFallbackCall({
      text: 'Что интересного есть на территории?',
      channel: 'web',
      guestId: 'unknown-party'
    });
    assert.equal(prepared.guestProfile.adults, null);
    assert.equal(prepared.guestProfile.children, null);
    assert.match(prepared.system, /не выдумывай состав гостей/i);
    assert.doesNotMatch(prepared.system, /Взрослые: \d/);
    assert.doesNotMatch(prepared.system, /Всего гостей: \d/);
  });

  it('9. в LLM не отправляется старые 12 сообщений, если данные в guest profile', () => {
    const channel = 'telegram';
    const guestId = 'history-window-1';
    const history = [];
    for (let i = 0; i < 6; i += 1) {
      history.push({
        role: 'user',
        content: i === 0 ? 'Нас двое взрослых и ребёнок 3 года, кроватка не нужна' : `Старое сообщение пользователя ${i}`
      });
      history.push({
        role: 'assistant',
        content: `Старый ответ ассистента ${i}`
      });
    }
    assert.equal(history.length, 12);

    const prepared = prepareAiFallbackCall({
      text: 'А фото комнаты можно?',
      history,
      channel,
      guestId
    });

    assert.equal(prepared.guestProfile.adults, 2);
    assert.equal(prepared.guestProfile.children, 1);
    assert.equal(prepared.messages.length, LLM_HISTORY_WINDOW + 1);
    assert.equal(prepared.messages.length < 12, true);
    assert.equal(
      prepared.messages.some((message) => message.content.includes('Старое сообщение пользователя 1')),
      false
    );
    assert.match(prepared.system, /Взрослые: 2/);
    assert.equal(typeof prepared.diagnostics.guestProfileChars, 'number');
    assert.equal(typeof prepared.diagnostics.historyChars, 'number');
    assert.ok(prepared.diagnostics.historyChars < 2000);
  });

  it('guest profile не называется MAX profile и ключ channel-independent', () => {
    const prepared = prepareAiFallbackCall({
      text: 'Нас трое взрослых',
      channel: 'vk',
      guestId: 'vk-user-7'
    });
    assert.equal(prepared.guestProfile.adults, 3);
    assert.doesNotMatch(prepared.system, /MAX profile|MAX-профиль/i);
    assert.match(formatGuestProfileForLlm(prepared.guestProfile), /ПРОФИЛЬ ГОСТЯ/);
  });
});

describe('STAGE 3B: FAQ и room-link по-прежнему не вызывают provider', () => {
  it('10. FAQ и room-links не вызывают provider', async () => {
    const fetchCalls = [];
    const askAICalls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'LLM' } }] })
      };
    };

    try {
      const run = (text) =>
        routeThenMaybeAskAI({
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

      const faq = await run('Можно пользоваться бассейном вечером?');
      const roomLink = await run('Покажи Комфорт для двоих');
      assert.equal(faq.type, 'faq');
      assert.equal(roomLink.type, 'room-link');
      assert.equal(askAICalls.length, 0);
      assert.equal(fetchCalls.length, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('STAGE 3B: diagnostics и сравнение с STAGE 3A', () => {
  beforeEach(() => {
    clearGuestContexts();
  });

  it('diagnostics содержит только числа и topics/roomSections, без переписки', () => {
    const prepared = prepareAiFallbackCall({
      text: 'Какой номер выбрать для семьи из пяти человек?',
      channel: 'max',
      guestId: 'diag-1'
    });
    const { diagnostics } = prepared;
    assert.equal(Array.isArray(diagnostics.topics), true);
    assert.equal(Array.isArray(diagnostics.roomSections), true);
    assert.equal(typeof diagnostics.systemChars, 'number');
    assert.equal(typeof diagnostics.knowledgeChars, 'number');
    assert.equal(typeof diagnostics.guestProfileChars, 'number');
    assert.equal(typeof diagnostics.historyChars, 'number');
    assert.equal(typeof diagnostics.totalApproxChars, 'number');
    const dump = JSON.stringify(diagnostics);
    assert.equal(dump.includes('семьи из пяти'), false);
    assert.equal(dump.includes('AI_API_KEY'), false);
    assert.equal(dump.includes('MAX_BOT_TOKEN'), false);
  });

  it('сравнивает STAGE 3A и STAGE 3B по объёму context', () => {
    const longHistory = [];
    for (let i = 0; i < 6; i += 1) {
      longHistory.push({
        role: 'user',
        content: i === 0 ? 'Нас двое взрослых и двое детей 3 и 10 лет' : `Ранее обсуждали детали ${i}`
      });
      longHistory.push({
        role: 'assistant',
        content: `Промежуточный ответ ${i} с повторением состава и пожеланий.`
      });
    }

    const scenarios = [
      {
        id: 'A',
        label: 'сложный подбор семьи из 5',
        text: 'Мы семья из пяти человек, подберите, пожалуйста, наиболее комфортный вариант размещения на двоих взрослых и троих детей.'
      },
      {
        id: 'B',
        label: 'Комфорт + ребёнок',
        text: 'Расскажите про Комфорт для двоих взрослых и ребёнка 2 лет, нужна кроватка'
      },
      {
        id: 'C',
        label: 'сравнение Делюкс 2/3',
        text: 'Чем отличается Делюкс второго и третьего этажа, если смотреть и планировку, и балкон?'
      },
      {
        id: 'D',
        label: 'балкон + кроватка',
        text: 'Нас двое взрослых и ребёнок 2 года, нужна кроватка и хотим большой балкон, что лучше выбрать?'
      },
      {
        id: 'E',
        label: 'follow-up после собранного состава',
        text: 'А с большим балконом что лучше?',
        history: longHistory,
        channel: 'max',
        guestId: 'measure-e'
      }
    ];

    const rows = scenarios.map((scenario) => {
      const history = scenario.history || [];
      if (scenario.guestId) {
        prepareAiFallbackCall({
          text: 'Нас двое взрослых и ребёнок 3 года',
          channel: scenario.channel,
          guestId: scenario.guestId
        });
      }
      const stage3a = measureStage3A(scenario.text, history);
      const stage3b = prepareAiFallbackCall({
        text: scenario.text,
        history,
        channel: scenario.channel || 'max',
        guestId: scenario.guestId || `measure-${scenario.id}`
      });
      const after = stage3b.diagnostics.totalApproxChars;
      const before = stage3a.totalApproxChars;
      return {
        id: scenario.id,
        label: scenario.label,
        stage3aChars: before,
        stage3bChars: after,
        reduction: reductionPct(before, after),
        stage3aKnowledge: stage3a.knowledgeChars,
        stage3bKnowledge: stage3b.diagnostics.knowledgeChars,
        roomSections: stage3b.diagnostics.roomSections,
        historyChars3a: stage3a.historyChars,
        historyChars3b: stage3b.diagnostics.historyChars
      };
    });

    console.log('[STAGE 3B SAVINGS]', JSON.stringify(rows, null, 2));

    for (const row of rows) {
      assert.ok(row.stage3bChars > 0, row.id);
      assert.ok(
        row.stage3bChars < row.stage3aChars,
        `${row.id} STAGE 3B must be smaller than STAGE 3A: ${row.stage3bChars} vs ${row.stage3aChars}`
      );
    }

    const family = rows.find((row) => row.id === 'A');
    assert.ok(
      family.stage3bKnowledge < 35000,
      `семья из 5 не должна получать полный dump комнат, knowledge=${family.stage3bKnowledge}`
    );
  });
});

describe('STAGE 3B: канонические правила комнат сохранены в секциях', () => {
  it('Comfort / Deluxe / Family / cot rules присутствуют в выбранных секциях', () => {
    const comfort = retrieveKnowledge({ text: 'Расскажите про Комфорт' });
    assert.match(comfort.context, /до 3 гостей/);

    const deluxe = retrieveKnowledge({ text: 'Чем отличается Делюкс 2 от Делюкс 3?' });
    assert.match(deluxe.context, /до 4 гостей/);
    assert.match(deluxe.context, /небольшой французский балкон/);
    assert.match(deluxe.context, /большой балкон с уличной мебелью/);

    const family = retrieveKnowledge({ text: 'Нас пятеро, одна семья' });
    assert.match(family.context, /до 5 гостей/);
    assert.match(family.context, /две комнаты/);

    const cot = retrieveKnowledge({
      text: '4 гостя в Делюкс и нужна кроватка'
    });
    assert.match(cot.context, /при размещении 4 гостей детскую кроватку НЕ устанавливаем|не устанавливаем/i);
  });

  it('полный dump комнат STAGE 3A доступен только как baseline', () => {
    const full = buildFullRoomsTopicSection();
    assert.match(full, /comfort_2floor/);
    assert.match(full, /deluxe_2floor/);
    assert.match(full, /deluxe_3floor/);
    assert.match(full, /family_room/);
    assert.ok(full.length > 20000);
  });
});
