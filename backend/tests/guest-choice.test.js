import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoomSelectionHint } from '../src/room-sales-logic.js';
import { emptyGuestProfile, extractGuestFacts } from '../src/core/guest-context/profile.js';
import { SALES_CORE } from '../src/core/knowledge/system-core.js';
import { buildRoomGeneralRulesSection } from '../src/core/knowledge/rooms.js';

describe('пакет №5.1: Guest Choice Respect Rule', () => {
  it('1. двое + подробнее о Семейной → Family, без перевода в Comfort', () => {
    const text = 'Нас двое, хотим подробнее узнать о Семейной комнате';
    const profile = extractGuestFacts(text);
    const hint = buildRoomSelectionHint(text, [], profile);
    assert.match(hint, /УВАЖЕНИЯ ВЫБОРА ГОСТЯ/i);
    assert.match(hint, /ответить именно про «Семейная»/i);
    assert.doesNotMatch(hint, /КОРРЕКЦИИ ВЫБОРА/i);
    assert.doesNotMatch(hint, /Основной вариант[\s\S]*«Комфорт»/i);
  });

  it('2. 2 взрослых + ребёнок 7 лет + хотим Делюкс → Deluxe, без авто-Comfort', () => {
    const text = '2 взрослых и ребёнок 7 лет, хотим Делюкс, видели его на сайте';
    const profile = extractGuestFacts(text);
    assert.equal(profile.selectedRoom, 'deluxe');
    const hint = buildRoomSelectionHint(text, [], profile);
    assert.match(hint, /УВАЖЕНИЯ ВЫБОРА ГОСТЯ/i);
    assert.match(hint, /ответить именно про «Делюкс»/i);
    assert.doesNotMatch(hint, /КОРРЕКЦИИ ВЫБОРА/i);
    assert.doesNotMatch(hint, /Основной вариант[\s\S]*«Комфорт»/i);
  });

  it('3. четверо + хотим Комфорт → коррекция вместимости и альтернатива', () => {
    const text = 'Нас четверо, хотим Комфорт';
    const profile = {
      ...emptyGuestProfile(),
      ...extractGuestFacts(text),
      partySize: 4,
      adults: 4,
      children: 0
    };
    const hint = buildRoomSelectionHint(text, [], profile);
    assert.match(hint, /КОРРЕКЦИИ ВЫБОРА ГОСТЯ/i);
    assert.match(hint, /превышает вместимость|до 3/i);
    assert.match(hint, /альтернатив|другие варианты/i);
    assert.match(hint, /без «нельзя»|через комфорт/i);
  });

  it('4. двое + хотим Family → поддержка выбора', () => {
    const profile = extractGuestFacts('Нас двое, хотим Семейную');
    const hint = buildRoomSelectionHint('Нас двое, хотим Семейную', [], profile);
    assert.match(hint, /УВАЖЕНИЯ ВЫБОРА ГОСТЯ/i);
    assert.match(hint, /Семейная/i);
    assert.doesNotMatch(hint, /КОРРЕКЦИИ ВЫБОРА/i);
  });

  it('5. чем отличается Comfort от Deluxe → факты, без лучше/хуже в правилах сравнения', () => {
    const text = 'Чем отличается Комфорт от Делюкс?';
    const hint = buildRoomSelectionHint(text, [], emptyGuestProfile());
    assert.match(hint, /СРАВНЕНИЯ КАТЕГОРИЙ/i);
    assert.match(hint, /только подтверждённые факты/i);
    assert.match(hint, /ЗАПРЕЩЕНО[\s\S]*лучше[\s\S]*хуже/i);
  });

  it('SALES_CORE и general rules содержат уважение выбора гостя', () => {
    assert.match(SALES_CORE, /ВЫБОР ГОСТЯ|сам назвал/i);
    assert.ok(SALES_CORE.length < 2500);
    const rules = buildRoomGeneralRulesSection();
    assert.match(rules, /сам спросил про конкретную категорию|выбранную категорию/i);
  });
});
