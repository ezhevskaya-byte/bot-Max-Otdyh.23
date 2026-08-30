import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCompositionClarificationResponse,
  needsGuestCompositionClarification
} from '../src/core/guest-context/composition-gate.js';
import { emptyGuestProfile, extractGuestFacts } from '../src/core/guest-context/profile.js';
import {
  attachFirstContactGreeting,
  withFirstContactGreeting
} from '../src/core/channel/first-greeting.js';
import { routeThenMaybeAskAI } from '../src/core/router.js';

function assertNoRoomRecommendation(text) {
  assert.doesNotMatch(text, /комфорт/i);
  assert.doesNotMatch(text, /делюкс/i);
  assert.doesNotMatch(text, /семейная|семейную|семейной/i);
}

/** Production-like: router + единый greeting wrapper (как в processUpdate). */
async function routeLikeProduction({ text, history = [], guestProfile = null, askAI }) {
  const routed = await routeThenMaybeAskAI({
    text,
    history,
    guestProfile: guestProfile || emptyGuestProfile(),
    askAI
  });
  return attachFirstContactGreeting(routed, history);
}

describe('follow-up: composition parsing + greeting', () => {
  it('1. «Нужен номер на троих» → clarification, без комнаты', async () => {
    const text = 'Нужен номер на троих';
    assert.equal(extractGuestFacts(text).partySize, 3);
    const result = await routeLikeProduction({
      text,
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
    assertNoRoomRecommendation(result.text);
  });

  it('2. «Здравствуйте, нужен номер на троих» → clarification', async () => {
    const result = await routeLikeProduction({
      text: 'Здравствуйте, нужен номер на троих',
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
    assertNoRoomRecommendation(result.text);
  });

  it('3. «Нас трое» → clarification', async () => {
    const result = await routeLikeProduction({
      text: 'Нас трое',
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
  });

  it('4. «Номер для 3 человек» → clarification', async () => {
    const text = 'Номер для 3 человек';
    assert.equal(extractGuestFacts(text).partySize, 3);
    const result = await routeLikeProduction({
      text,
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
  });

  it('5. «Ищем номер на три человека» → clarification', async () => {
    const result = await routeLikeProduction({
      text: 'Ищем номер на три человека',
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
  });

  it('6. «Мы вдвоём» → clarification', async () => {
    const text = 'Мы вдвоём';
    const facts = extractGuestFacts(text);
    assert.equal(facts.partySize, 2);
    assert.equal(facts.adults, null);
    assert.equal(needsGuestCompositionClarification(facts, text), true);
    const result = await routeLikeProduction({
      text,
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
    assertNoRoomRecommendation(result.text);
  });

  it('7. «Нас двое» → clarification', async () => {
    const result = await routeLikeProduction({
      text: 'Нас двое',
      askAI: async () => 'Комфорт'
    });
    assert.equal(result.data?.compositionGate, true);
  });

  it('8. «Нас трое взрослых» → gate не блокирует', async () => {
    const text = 'Нас трое взрослых';
    const facts = extractGuestFacts(text);
    assert.equal(facts.adults, 3);
    assert.equal(needsGuestCompositionClarification(facts, text), false);
    let called = false;
    await routeLikeProduction({
      text,
      guestProfile: facts,
      askAI: async () => {
        called = true;
        return 'Комфорт для троих взрослых';
      }
    });
    assert.equal(called, true);
  });

  it('9. «Нас двое взрослых» → gate не блокирует', async () => {
    const text = 'Нас двое взрослых';
    const facts = extractGuestFacts(text);
    assert.equal(facts.adults, 2);
    assert.equal(needsGuestCompositionClarification(facts, text), false);
  });

  it('10. «Два взрослых и ребёнок 7 лет» → gate не блокирует', async () => {
    const text = 'Два взрослых и ребёнок 7 лет';
    const facts = extractGuestFacts(text);
    assert.deepEqual(facts.childrenAges, [7]);
    assert.equal(needsGuestCompositionClarification(facts, text), false);
  });

  it('11. «2 взрослых и двое детей 5 и 9 лет» → ages извлечены, gate молчит', async () => {
    const text = '2 взрослых и двое детей 5 и 9 лет';
    const facts = extractGuestFacts(text);
    assert.equal(facts.adults, 2);
    assert.equal(facts.children, 2);
    assert.deepEqual(facts.childrenAges, [5, 9]);
    assert.equal(needsGuestCompositionClarification(facts, text), false);
  });

  it('12–16. false positives partySize: дни / сутки / ночи / этаж', () => {
    const cases = [
      'Будем отдыхать на 3 дня',
      'Можно номер для отдыха на трое суток?',
      'Остановимся на 5 ночей',
      'Номер на 2 этаже',
      'Хотим Делюкс на 3 этаже'
    ];
    for (const text of cases) {
      const facts = extractGuestFacts(text);
      assert.equal(facts.partySize, null, `partySize for: ${text}`);
      assert.equal(
        needsGuestCompositionClarification(emptyGuestProfile(), text),
        false,
        `gate for: ${text}`
      );
    }
  });

  it('17. первый composition-gate response → greeting', async () => {
    const result = await routeLikeProduction({
      text: 'Нужен номер на троих',
      askAI: async () => 'x'
    });
    assert.equal(result.data?.compositionGate, true);
    assert.match(result.text, /^Здравствуйте!/i);
  });

  it('18. первый FAQ response → greeting', async () => {
    const result = await routeLikeProduction({
      text: 'Есть бассейн?',
      askAI: async () => 'не FAQ'
    });
    assert.equal(result.type, 'faq');
    assert.match(result.text, /^Здравствуйте!/i);
    assert.match(result.text, /бассейн/i);
  });

  it('19. первый AI fallback → greeting', async () => {
    const result = await routeLikeProduction({
      text: 'Расскажите про отдых у вас',
      askAI: async () => 'У нас уютный гостевой дом у моря.'
    });
    assert.equal(result.data?.fallback, true);
    assert.match(result.text, /^Здравствуйте!/i);
  });

  it('20. первый room-link response → greeting, URL цел', async () => {
    const result = await routeLikeProduction({
      text: 'Покажи Комфорт для двоих',
      askAI: async () => 'не должно'
    });
    assert.equal(result.type, 'room-link');
    assert.match(result.text, /^Здравствуйте!/i);
    assert.match(result.text, /https:\/\/otdyh23\.ru\/\?room=comfort/);
    assert.match(result.data?.url || '', /room=comfort/);
  });

  it('21. второй ответ диалога → без обязательного greeting', async () => {
    const history = [
      { role: 'user', content: 'Есть бассейн?' },
      { role: 'assistant', content: 'Здравствуйте! На территории есть бассейн.' }
    ];
    const result = await routeLikeProduction({
      text: 'А бассейн подогреваемый?',
      history,
      askAI: async () => 'x'
    });
    assert.doesNotMatch(result.text, /^Здравствуйте/i);
  });

  it('22. дубля «Здравствуйте» нет', () => {
    assert.equal(
      withFirstContactGreeting('Здравствуйте! Чем могу помочь?', []),
      'Здравствуйте! Чем могу помочь?'
    );
    const attached = attachFirstContactGreeting(
      { text: 'Здравствуйте! Ссылка https://otdyh23.ru/?room=comfort' },
      []
    );
    assert.equal((attached.text.match(/Здравствуйте/gi) || []).length, 1);
  });

  it('доп. «дети 5 лет и 9 лет» и «ребёнок 6 лет»', () => {
    assert.deepEqual(extractGuestFacts('дети 5 лет и 9 лет').childrenAges, [5, 9]);
    assert.deepEqual(extractGuestFacts('двое детей 5 и 9 лет').childrenAges, [5, 9]);
    assert.deepEqual(
      extractGuestFacts('двое взрослых и ребёнок 6 лет').childrenAges,
      [6]
    );
  });

  it('доп. «Мы вдвоём, оба взрослые» → gate не блокирует', () => {
    const text = 'Мы вдвоём, оба взрослые';
    const facts = extractGuestFacts(text);
    assert.equal(facts.partySize, 2);
    assert.equal(facts.adults, 2);
    assert.equal(needsGuestCompositionClarification(facts, text), false);
  });

  it('диалог A: троих → 2+1/7 лет без повторного greeting', async () => {
    const history = [];
    const r1 = await routeLikeProduction({
      text: 'Нужен номер на троих',
      history,
      askAI: async () => 'BAD'
    });
    assert.equal(r1.data?.compositionGate, true);
    assert.match(r1.text, /^Здравствуйте!/i);
    assertNoRoomRecommendation(r1.text);

    history.push({ role: 'user', content: 'Нужен номер на троих' });
    history.push({ role: 'assistant', content: r1.text });

    const follow = 'Двое взрослых и ребёнок 7 лет';
    const r2 = await routeLikeProduction({
      text: follow,
      history,
      guestProfile: extractGuestFacts(follow),
      askAI: async () =>
        'Для вашего состава хорошо подойдёт категория «Комфорт». Могу показать фото.'
    });
    assert.equal(r2.data?.compositionGate, undefined);
    assert.doesNotMatch(r2.text, /^Здравствуйте/i);
    assert.match(r2.text, /Комфорт/i);
  });
});
