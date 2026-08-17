import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRuDate, nightsBetween, isValidDateRange } from '../src/utils/dates.js';

describe('dates', () => {
  it('парсит дату ДД.ММ.ГГГГ', () => {
    const d = parseRuDate('15.06.2026');
    assert.ok(d);
    assert.equal(d.getDate(), 15);
  });

  it('считает ночи', () => {
    assert.equal(nightsBetween('10.06.2026', '13.06.2026'), 3);
  });

  it('проверяет диапазон', () => {
    assert.ok(isValidDateRange('10.06.2026', '12.06.2026'));
    assert.ok(!isValidDateRange('12.06.2026', '10.06.2026'));
  });
});
