import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchFaq, FAQ_INTENTS } from '../src/core/faq/answers.js';
import { normalizeText } from '../src/core/text-normalize.js';
import { routeMessage } from '../src/core/router.js';

function faq(text) {
  return matchFaq(normalizeText(text));
}

function routed(text) {
  return routeMessage({ text });
}

const JUSTIFICATION_FORBIDDEN = /чист(?:ым|ыми|от)|свеж(?:им|ими|ест)|без запах|запахов еды|спокойн(?:ую|ой) атмосфер/i;
const PRODUCTS_IN_MINI_FORBIDDEN = /небольш(?:ое|ого) количество продукт/i;
const FRIDGE_PRODUCT_BAN_FORBIDDEN = /продукт.*запрещ|запрещ.*продукт/i;

describe('FAQ household: пакет №3 + 3.1', () => {
  describe('A. REFRIGERATOR', () => {
    it('«А холодильник в номере есть?» — напитки + терраса для продуктов', () => {
      const result = routed('А холодильник в номере есть?');
      assert.equal(result.data.intent, 'room_refrigerator');
      assert.match(result.text, /Да/i);
      assert.match(result.text, /мини-холодильник/i);
      assert.match(result.text, /напитк/i);
      assert.match(result.text, /террас/i);
      assert.doesNotMatch(result.text, PRODUCTS_IN_MINI_FORBIDDEN);
      assert.notEqual(result.data?.intent, 'meals_in_rooms');
    });

    it('«Большой холодильник есть?» — мини для напитков, продукты на террасе', () => {
      const result = faq('Большой холодильник есть?');
      assert.equal(result?.data?.intent, 'room_refrigerator');
      assert.match(result.text, /мини-холодильник/i);
      assert.match(result.text, /напитк/i);
      assert.match(result.text, /террас/i);
      assert.doesNotMatch(result.text, /больш(?:ой|ие) холодильник/i);
      assert.doesNotMatch(result.text, PRODUCTS_IN_MINI_FORBIDDEN);
    });

    it('«А где хранить продукты?» — холодильники на террасе', () => {
      const result = routed('А где хранить продукты?');
      assert.equal(result.data.intent, 'room_refrigerator');
      assert.match(result.text, /террас/i);
      assert.match(result.text, /холодильник/i);
      assert.match(result.text, /продукт/i);
    });

    it('«Можно продукты положить в холодильник в номере?» — без запрета, рекомендация террасы', () => {
      const result = routed('Можно продукты положить в холодильник в номере?');
      assert.equal(result.data.intent, 'room_refrigerator');
      assert.match(result.text, /напитк/i);
      assert.match(result.text, /террас/i);
      assert.match(result.text, /рекоменду/i);
      assert.doesNotMatch(result.text, FRIDGE_PRODUCT_BAN_FORBIDDEN);
      assert.doesNotMatch(result.text, PRODUCTS_IN_MINI_FORBIDDEN);
    });
  });

  describe('B. TEA / KETTLE', () => {
    it('«А чай в номере можно сделать?» — сначала терраса, затем правило номера', () => {
      const result = routed('А чай в номере можно сделать?');
      assert.equal(result.data.intent, 'tea_in_room');
      assert.match(result.text, /термопот/i);
      assert.match(result.text, /чайник/i);
      assert.ok(result.text.indexOf('террас') < result.text.indexOf('не предусмотрен'));
      assert.doesNotMatch(result.text, JUSTIFICATION_FORBIDDEN);
    });

    it('«Можно свой чайник в номер?» — решение через террасу, без жёсткого «Нет, ... нельзя»', () => {
      const result = routed('Можно свой чайник в номер?');
      assert.equal(result.data.intent, 'own_kettle');
      assert.match(result.text, /термопот/i);
      assert.match(result.text, /собственн.*чайник|чайник.*собственн/i);
      assert.doesNotMatch(result.text, /^Нет,\s/i);
      assert.doesNotMatch(result.text, /мультиварк/i);
    });
  });

  describe('C. MICROWAVE', () => {
    it('«А еду разогреть где-нибудь можно?» — позитивный ответ, микроволновка', () => {
      const result = routed('А еду разогреть где-нибудь можно?');
      assert.equal(result.data.intent, 'microwave');
      assert.match(result.text, /микроволнов/i);
      assert.match(result.text, /террас/i);
      assert.doesNotMatch(result.text, JUSTIFICATION_FORBIDDEN);
    });

    it('«Где разогреть еду?» → microwave', () => {
      assert.equal(faq('Где разогреть еду?')?.data?.intent, 'microwave');
    });
  });

  describe('D. MEALS', () => {
    it('«А покушать в номере можно?» — терраса первая, правило комнаты ясно', () => {
      const result = routed('А покушать в номере можно?');
      assert.equal(result.data.intent, 'meals_in_rooms');
      assert.match(result.text, /террас/i);
      assert.match(result.text, /просим пищу не принимать|не принимать/i);
      assert.ok(result.text.indexOf('террас') < result.text.indexOf('не принимать'));
      assert.doesNotMatch(result.text, JUSTIFICATION_FORBIDDEN);
    });
  });

  describe('E. KITCHEN', () => {
    it('«Кухня есть?» — сначала терраса, затем нет полноценной кухни', () => {
      const result = routed('Кухня есть?');
      assert.equal(result.data.intent, 'kitchen');
      assert.match(result.text, /террас/i);
      assert.match(result.text, /полноценн.*кухн.*нет/i);
      assert.ok(result.text.indexOf('террас') < result.text.indexOf('нет'));
      assert.doesNotMatch(result.text, /мультиварк/i);
    });
  });

  describe('F. POOL (без регрессии)', () => {
    it('«Бассейн есть?» — компактный pool_simple', () => {
      const result = routed('Бассейн есть?');
      assert.equal(result.data.intent, 'pool_simple');
      assert.match(result.text, /подогрева/i);
      assert.match(result.text, /09:00 до 21:00/);
      assert.doesNotMatch(result.text, /бесплат|платн|входит в/i);
    });

    it('«Что у вас с бассейном?» — полный pool FAQ сохранён', () => {
      const pool = FAQ_INTENTS.find((item) => item.id === 'pool');
      assert.match(pool.text, /8,6/);
      assert.match(pool.text, /спасател/i);
    });
  });

  describe('G. FALSE POSITIVE GUARD', () => {
    const matrix = [
      { text: 'Фен в номере есть?', forbidden: 'meals_in_rooms' },
      { text: 'Холодильник в номере есть?', expected: 'room_refrigerator' },
      { text: 'Телевизор в номере есть?', forbidden: 'meals_in_rooms' },
      { text: 'Сейф в номере есть?', forbidden: 'meals_in_rooms' },
      { text: 'Можно есть в номере?', expected: 'meals_in_rooms' },
      { text: 'Можно свой чайник в номер?', expected: 'own_kettle' }
    ];

    for (const { text, expected, forbidden } of matrix) {
      it(`routeMessage: «${text}»`, () => {
        const result = routed(text);
        if (expected) {
          assert.equal(result.data?.intent, expected, text);
        }
        if (forbidden) {
          assert.notEqual(result.data?.intent, forbidden, text);
        }
      });
    }

    it('equipment questions без FAQ → AI fallback допустим', () => {
      const result = routed('Фен в номере есть?');
      assert.notEqual(result.data?.intent, 'meals_in_rooms');
      assert.equal(result.type, 'ai');
    });
  });
});
