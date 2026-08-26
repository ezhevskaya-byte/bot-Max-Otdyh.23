import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { routeMessage, routeThenMaybeAskAI } from '../src/core/router.js';
import { complete } from '../src/core/ai/provider.js';
import {
  retrieveKnowledge,
  prepareAiFallbackCall,
  buildLegacyFullSystemPrompt,
  SYSTEM_CORE,
  SALES_CORE,
  TOPICS
} from '../src/core/knowledge/index.js';

function hasTopic(result, topic) {
  return result.topics.includes(topic);
}

function reductionPct(before, after) {
  return Math.round((1 - after / before) * 1000) / 10;
}

describe('STAGE 3A: knowledge retriever', () => {
  it('1. семья из пяти → ROOMS + SALES, Семейная до 5 в context', () => {
    const result = retrieveKnowledge({
      text: 'Какой номер выбрать для семьи из пяти человек?'
    });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.SALES), true);
    assert.equal(result.fallback, false);
    assert.match(result.context, /Семейная/i);
    assert.match(result.context, /до 5 гостей/i);
  });

  it('2. вдвоём и ребёнок 2 года + кроватка → ROOMS + BABY_COT, бесплатная кроватка', () => {
    const result = retrieveKnowledge({
      text: 'Мы вдвоём и ребёнку 2 года, нужна кроватка'
    });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.BABY_COT), true);
    assert.match(result.context, /без дополнительной платы|входит в стоимость/i);
    assert.match(result.context, /до 4 лет/i);
  });

  it('3. четверо + кроватка в Делюкс → ROOMS + BABY_COT, запрет Делюкс 4 + кроватка', () => {
    const result = retrieveKnowledge({
      text: 'Нас четверо и нужна кроватка в Делюкс'
    });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.BABY_COT), true);
    assert.match(result.context, /4 гост/i);
    assert.match(result.context, /не устанавливаем|не предлагать конфигурацию/i);
    assert.match(result.context, /Семейную|Семейной/i);
  });

  it('4. большой балкон обрабатывает deterministic router до retrieval', () => {
    const routed = routeMessage({ text: 'Хочу номер с большим балконом' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'deluxe_large_balcony');
  });

  it('5. бассейн вечером — deterministic FAQ до retrieval', () => {
    const routed = routeMessage({ text: 'Можно пользоваться бассейном вечером?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'pool');
  });

  it('6. сложный вопрос про бассейн, не покрытый FAQ → POOL', () => {
    const text =
      'Подскажите, пожалуйста, насколько удобно будет с детьми у бассейна, если мы приедем вечером после дороги и хотим немного покупаться: есть ли подогрев, какая глубина и какие правила безопасности для малышей, чтобы я понимала, стоит ли брать надувной круг?';
    const routed = routeMessage({ text });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
    const result = retrieveKnowledge({ text });
    assert.equal(hasTopic(result, TOPICS.POOL), true);
    assert.equal(result.fallback, false);
    assert.match(result.context, /подогреваем/i);
    assert.doesNotMatch(result.context, /мангал/i);
  });

  it('7. завтрак и кухня → TERRACE_FOOD', () => {
    const result = retrieveKnowledge({
      text: 'Где можно позавтракать и есть ли кухня?'
    });
    assert.equal(hasTopic(result, TOPICS.TERRACE_FOOD), true);
    assert.equal(result.fallback, false);
    assert.match(result.context, /террас/i);
    assert.match(result.context, /микроволн|термопот|холодильник/i);
  });

  it('8. как добраться до моря с ребёнком → SEA_LOCATION без обязательного SALES', () => {
    const result = retrieveKnowledge({
      text: 'Как добраться до моря с ребёнком?'
    });
    assert.equal(hasTopic(result, TOPICS.SEA_LOCATION), true);
    assert.equal(hasTopic(result, TOPICS.SALES), false);
    assert.equal(result.fallback, false);
    assert.match(result.context, /15–16|15-16/);
    assert.match(result.context, /микроавтобус/i);
  });

  it('9. есть мангал — deterministic FAQ', () => {
    const routed = routeMessage({ text: 'Есть мангал?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'barbecue_area');
  });

  it('10. сложный вопрос о шашлыке/открытом огне → BARBECUE', () => {
    const text =
      'Мы хотели бы вечером собраться небольшой компанией и пожарить шашлык на открытом огне, можно ли это сделать на территории и какие ограничения по мангалу сейчас действуют, чтобы заранее понять формат отдыха?';
    const routed = routeMessage({ text });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
    const result = retrieveKnowledge({ text });
    assert.equal(hasTopic(result, TOPICS.BARBECUE), true);
    assert.equal(result.fallback, false);
    assert.match(result.context, /мангальн/i);
    assert.match(result.context, /ON_REQUEST_ONLY/);
  });

  it('11. рассказ о территории не включает BARBECUE', () => {
    const result = retrieveKnowledge({ text: 'Расскажите о территории' });
    assert.equal(hasTopic(result, TOPICS.BARBECUE), false);
    assert.equal(result.fallback, false);
    assert.doesNotMatch(result.context, /мангал|шашлык|барбекю|гриль/i);
  });

  it('12. можно приехать раньше — deterministic FAQ', () => {
    const routed = routeMessage({ text: 'Можно приехать раньше?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'check_in_out');
  });

  it('13. unknown low-confidence → безопасный fallback, context не пустой', () => {
    const result = retrieveKnowledge({
      text: 'Можно ли провести у вас выездную фотосессию с дымовой шашкой и квадрокоптером на рассвете по фен-шую?'
    });
    assert.equal(result.fallback, true);
    assert.ok(result.topics.length > 0);
    assert.equal(hasTopic(result, TOPICS.BARBECUE), false);
    assert.ok(result.context.trim().length > 500);
    assert.match(result.context, /Семейная|бассейн|террас/i);
  });

  it('14. continuation: Делюкс 3 этаж → «А кроватку туда можно?» = ROOMS + BABY_COT', () => {
    const result = retrieveKnowledge({
      text: 'А кроватку туда можно?',
      conversationContext: {
        previousTopics: [TOPICS.ROOMS],
        messages: [
          { role: 'user', content: 'Расскажите про Делюкс на третьем этаже' },
          {
            role: 'assistant',
            content: '«Делюкс» на 3 этаже — это большой балкон с уличной мебелью.'
          }
        ]
      }
    });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.BABY_COT), true);
    assert.match(result.context, /кроватк/i);
  });

  it('мультитематический подбор: вдвоём с ребёнком 2 лет, что лучше выбрать', () => {
    const result = retrieveKnowledge({
      text: 'Мы едем вдвоём с ребёнком 2 лет, что лучше выбрать?'
    });
    assert.equal(hasTopic(result, TOPICS.ROOMS), true);
    assert.equal(hasTopic(result, TOPICS.BABY_COT), true);
    assert.equal(hasTopic(result, TOPICS.SALES), true);
  });
});

describe('STAGE 3A: FAQ и room-link не вызывают provider', () => {
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

  it('15. deterministic FAQ не вызывает provider', async () => {
    const result = await run('Можно пользоваться бассейном вечером?');
    assert.equal(result.handled, true);
    assert.equal(result.type, 'faq');
    assert.equal(askAICalls.length, 0);
    assert.equal(fetchCalls.length, 0);
  });

  it('16. room-link/photo route не вызывает provider', async () => {
    const result = await run('Покажи Комфорт для двоих');
    assert.equal(result.handled, true);
    assert.equal(result.type, 'room-link');
    assert.equal(askAICalls.length, 0);
    assert.equal(fetchCalls.length, 0);
  });
});

describe('STAGE 3A: system core, diagnostics, экономия контекста', () => {
  it('SYSTEM CORE компактный и не содержит всю базу комнат', () => {
    assert.match(SYSTEM_CORE, /Отдых\.23/);
    assert.match(SYSTEM_CORE, /не придумывай/i);
    assert.match(SYSTEM_CORE, /ON_REQUEST_ONLY/);
    assert.doesNotMatch(SYSTEM_CORE, /КОМНАТА: family_room/);
    assert.ok(SYSTEM_CORE.length < 4000);
    assert.ok(SALES_CORE.length < 2500);
  });

  it('diagnostics содержит только метрики и topics, без текста переписки', () => {
    const prepared = prepareAiFallbackCall({
      text: 'Какой номер выбрать для семьи из пяти человек?'
    });
    const { diagnostics } = prepared;
    assert.equal(Array.isArray(diagnostics.topics), true);
    assert.equal(typeof diagnostics.knowledgeChars, 'number');
    assert.equal(typeof diagnostics.systemChars, 'number');
    assert.equal(typeof diagnostics.historyChars, 'number');
    assert.equal(typeof diagnostics.totalApproxChars, 'number');
    const dump = JSON.stringify(diagnostics);
    assert.equal(dump.includes('семьи из пяти'), false);
    assert.equal(dump.includes('AI_API_KEY'), false);
    assert.equal(dump.includes('MAX_BOT_TOKEN'), false);
  });

  it('сравнивает BEFORE/AFTER knowledge+system context на 5 AI-сценариях', () => {
    const before = buildLegacyFullSystemPrompt('').length;
    const scenarios = [
      {
        id: 'A',
        label: 'сложный подбор комнаты',
        text: 'Мы едем вдвоём с ребёнком 2 лет, что лучше выбрать, чтобы было не тесно и можно было поставить кроватку?'
      },
      {
        id: 'B',
        label: 'сложный вопрос о море',
        text: 'Как удобнее добраться до моря с маленьким ребёнком, если пешком может быть тяжело, и куда выходит микроавтобус?'
      },
      {
        id: 'C',
        label: 'сложный вопрос о террасе/питании',
        text: 'Где можно позавтракать с детьми, есть ли кухня, холодильник и можно ли разогреть еду вечером на террасе?'
      },
      {
        id: 'D',
        label: 'сложный вопрос о правилах',
        text: 'Подскажите про тишину, курение, закрытую территорию и можно ли приглашать посетителей вечером, если мы приедем с детьми?'
      },
      {
        id: 'E',
        label: 'unknown low-confidence',
        text: 'Можно ли провести у вас выездную фотосессию с дымовой шашкой и квадрокоптером на рассвете по фен-шую?'
      }
    ];

    const rows = scenarios.map((scenario) => {
      const prepared = prepareAiFallbackCall({ text: scenario.text });
      const after = prepared.system.length;
      return {
        ...scenario,
        before,
        after,
        reduction: reductionPct(before, after),
        topics: prepared.diagnostics.topics,
        fallback: prepared.diagnostics.fallback
      };
    });

    console.log('[STAGE 3A SAVINGS]', JSON.stringify(rows, null, 2));

    for (const row of rows) {
      assert.ok(row.after > 0, row.id);
      assert.ok(row.after < row.before, `${row.id} must be smaller than legacy`);
    }

    const themed = rows.filter((row) => row.id !== 'E');
    for (const row of themed) {
      assert.ok(
        row.reduction >= 20,
        `${row.id} expected noticeable reduction, got ${row.reduction}%`
      );
    }
  });

  it('итоговая структура LLM-запроса без секретов: core + knowledge + history + question', () => {
    const prepared = prepareAiFallbackCall({
      text: 'Как удобнее добраться до моря с маленьким ребёнком, если пешком может быть тяжело?',
      history: [{ role: 'user', content: 'Здравствуйте' }, { role: 'assistant', content: 'Здравствуйте! Чем могу помочь?' }]
    });
    assert.match(prepared.system, /КОНТЕКСТ ЗНАНИЙ/);
    assert.match(prepared.system, /AI-администратор/);
    assert.equal(prepared.messages.at(-1).role, 'user');
    assert.equal(prepared.retrieved.topics.includes(TOPICS.SEA_LOCATION), true);
    assert.equal(JSON.stringify(prepared.diagnostics).includes('Bearer'), false);
  });
});
