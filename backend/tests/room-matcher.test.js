import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchRooms } from '../src/services/room-matcher.js';

describe('room-matcher', () => {
  it('подбирает Семейную для 2 гостей', () => {
    const matches = matchRooms({ adults: 2, children: 0 });
    assert.ok(matches.some((m) => m.roomTypeId === 'family'));
    assert.ok(matches.some((m) => m.roomTypeId === 'comfort'));
  });

  it('подбирает Семейную для 5 гостей', () => {
    const matches = matchRooms({ adults: 3, children: 2 });
    const family = matches.find((m) => m.roomTypeId === 'family');
    assert.ok(family);
    assert.equal(family.totalGuests, 5);
  });

  it('не подбирает номера для 6 гостей', () => {
    const matches = matchRooms({ adults: 4, children: 2 });
    assert.equal(matches.length, 0);
  });

  it('подбирает Комфорт для 3 гостей', () => {
    const matches = matchRooms({ adults: 2, children: 1 });
    const comfort = matches.find((m) => m.roomTypeId === 'comfort');
    assert.ok(comfort);
    assert.equal(comfort.totalGuests, 3);
  });
});
