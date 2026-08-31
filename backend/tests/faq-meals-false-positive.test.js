import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchFaq } from '../src/core/faq/answers.js';
import { normalizeText } from '../src/core/text-normalize.js';
import { routeMessage } from '../src/core/router.js';

function faqIntent(text) {
  const matched = matchFaq(normalizeText(text));
  return matched?.data?.intent || null;
}

describe('FAQ meals_in_rooms: без ложного match на «есть» = наличие', () => {
  it('матчит реальные вопросы о приёме пищи в комнате', () => {
    const positives = [
      'Можно есть в номере?',
      'Можно кушать в номере?',
      'Можно поесть в комнате?',
      'А покушать в номере можно?',
      'Разрешено есть в комнате?'
    ];
    for (const text of positives) {
      assert.equal(faqIntent(text), 'meals_in_rooms', text);
    }
  });

  it('не матчит вопросы о наличии вещей в номере', () => {
    const negatives = [
      'А фен в номере есть?',
      'Фен есть?',
      'Телевизор в номере есть?',
      'Холодильник в номере есть?',
      'Сейф в номере есть?',
      'Кондиционер в комнате есть?',
      'Балкон в номере есть?'
    ];
    for (const text of negatives) {
      assert.notEqual(faqIntent(text), 'meals_in_rooms', text);
    }
  });

  it('routeMessage: «А фен в номере есть?» не уходит в faq:meals_in_rooms', () => {
    const routed = routeMessage({ text: 'А фен в номере есть?' });
    assert.notEqual(routed.data?.intent, 'meals_in_rooms');
    assert.notEqual(routed.type === 'faq' && routed.data?.intent === 'meals_in_rooms', true);
    // Нет отдельного FAQ по фену — допустим AI fallback
    assert.equal(routed.type, 'ai');
  });
});
