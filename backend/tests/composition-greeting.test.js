import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCompositionClarificationResponse,
  needsGuestCompositionClarification
} from '../src/core/guest-context/composition-gate.js';
import { emptyGuestProfile, extractGuestFacts } from '../src/core/guest-context/profile.js';
import { withFirstContactGreeting } from '../src/core/channel/first-greeting.js';
import { routeThenMaybeAskAI } from '../src/core/router.js';

function assertNoRoomRecommendation(text) {
  assert.doesNotMatch(text, /комфорт/i);
  assert.doesNotMatch(text, /делюкс/i);
  assert.doesNotMatch(text, /семейная|семейную|семейной/i);
}

describe('live regression: composition gate + first greeting', () => {
  it('1. «Нужен номер на троих» → приветствие + состав, без рекомендации', async () => {
    const text = 'Нужен номер на троих';
    assert.equal(extractGuestFacts(text).partySize, 3);
    assert.equal(needsGuestCompositionClarification(emptyGuestProfile(), text), true);

    let providerCalled = false;
    const result = await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: emptyGuestProfile(),
      askAI: async () => {
        providerCalled = true;
        return 'Для троих подойдёт Комфорт';
      }
    });

    assert.equal(providerCalled, false);
    assert.equal(result.data?.compositionGate, true);
    assert.match(result.text, /^Здравствуйте!/i);
    assert.match(result.text, /взросл|состав|дети/i);
    assertNoRoomRecommendation(result.text);
    assert.equal((result.text.match(/Здравствуйте/gi) || []).length, 1);
  });

  it('2. «Здравствуйте. Нужен номер на троих» → приветствие AI + состав', async () => {
    const text = 'Здравствуйте. Нужен номер на троих';
    const result = await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: emptyGuestProfile(),
      askAI: async () => 'Не должно вызываться'
    });

    assert.equal(result.data?.compositionGate, true);
    assert.match(result.text, /^Здравствуйте!/i);
    assert.match(result.text, /взросл|состав|дети/i);
    assertNoRoomRecommendation(result.text);
  });

  it('3. «Нас трое» → уточнение состава', async () => {
    const text = 'Нас трое';
    assert.equal(needsGuestCompositionClarification(emptyGuestProfile(), text), true);
    const result = await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: emptyGuestProfile(),
      askAI: async () => 'Не должно вызываться'
    });
    assert.equal(result.data?.compositionGate, true);
    assertNoRoomRecommendation(result.text);
  });

  it('4. «Нас трое взрослых» → состав ясен, gate не блокирует', async () => {
    const text = 'Нас трое взрослых';
    const facts = extractGuestFacts(text);
    assert.equal(facts.adults, 3);
    assert.equal(needsGuestCompositionClarification(facts, text), false);

    let providerCalled = false;
    const result = await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: facts,
      askAI: async () => {
        providerCalled = true;
        return 'Для трёх взрослых хорошо подойдёт категория «Комфорт».';
      }
    });

    assert.equal(providerCalled, true);
    assert.equal(result.data?.compositionGate, undefined);
    assert.match(result.text, /^Здравствуйте!/i);
    assert.doesNotMatch(result.text, /есть ли дети|будут ли дети/i);
  });

  it('5. «Два взрослых и ребёнок 7 лет» → состав достаточен', async () => {
    const text = 'Два взрослых и ребёнок 7 лет';
    const facts = extractGuestFacts(text);
    assert.equal(needsGuestCompositionClarification(facts, text), false);

    let providerCalled = false;
    await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: facts,
      askAI: async () => {
        providerCalled = true;
        return 'Рекомендация Комфорт';
      }
    });
    assert.equal(providerCalled, true);
  });

  it('6. «Два взрослых и ребёнок» → уточнить возраст, не рекомендовать', async () => {
    const text = 'Два взрослых и ребёнок';
    assert.equal(needsGuestCompositionClarification(emptyGuestProfile(), text), true);

    const result = await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: emptyGuestProfile(),
      askAI: async () => 'Не должно вызываться'
    });

    assert.equal(result.data?.compositionGate, true);
    assert.match(result.text, /лет|возраст/i);
    assertNoRoomRecommendation(result.text);
  });

  it('7. «Есть бассейн?» → первый ответ с приветствием', async () => {
    const result = await routeThenMaybeAskAI({
      text: 'Есть бассейн?',
      history: [],
      guestProfile: emptyGuestProfile(),
      askAI: async () => 'Не должно вызываться для FAQ'
    });

    assert.equal(result.type, 'faq');
    assert.match(result.text, /^Здравствуйте!/i);
    assert.match(result.text, /бассейн/i);
  });

  it('8. второе сообщение → без повторного «Здравствуйте»', async () => {
    const history = [
      { role: 'user', content: 'Есть бассейн?' },
      {
        role: 'assistant',
        content: 'Здравствуйте! На территории есть подогреваемый бассейн.'
      }
    ];

    const result = await routeThenMaybeAskAI({
      text: 'А бассейн подогреваемый?',
      history,
      guestProfile: emptyGuestProfile(),
      askAI: async () => 'Не должно вызываться'
    });

    assert.equal(result.type, 'faq');
    assert.doesNotMatch(result.text, /^Здравствуйте/i);
    assert.match(result.text, /бассейн/i);
  });

  it('9. первое «Здравствуйте» → один ответ с приветствием', async () => {
    const result = await routeThenMaybeAskAI({
      text: 'Здравствуйте',
      history: [],
      guestProfile: emptyGuestProfile(),
      askAI: async () => 'Рада помочь подобрать комнату или ответить на вопросы об отдыхе.'
    });

    assert.match(result.text, /^Здравствуйте!/i);
    assert.equal((result.text.match(/Здравствуйте/gi) || []).length, 1);
  });

  it('greeting helper не дублирует уже существующее приветствие', () => {
    assert.equal(
      withFirstContactGreeting('Здравствуйте! Чем могу помочь?', []),
      'Здравствуйте! Чем могу помочь?'
    );
    assert.equal(
      withFirstContactGreeting('Чем могу помочь?', [
        { role: 'assistant', content: 'Здравствуйте!' }
      ]),
      'Чем могу помочь?'
    );
  });
});
