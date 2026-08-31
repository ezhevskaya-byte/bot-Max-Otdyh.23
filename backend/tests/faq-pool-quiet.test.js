import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchFaq, FAQ_INTENTS } from '../src/core/faq/answers.js';
import { normalizeText } from '../src/core/text-normalize.js';
import { routeMessage } from '../src/core/router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function faq(text) {
  return matchFaq(normalizeText(text));
}

function routed(text) {
  return routeMessage({ text });
}

const POOL_PAYMENT_FORBIDDEN = [
  /бесплат/i,
  /платн/i,
  /входит в проживание/i,
  /входит в стоимость/i,
  /без дополнительной оплаты/i,
  /доплачивать не нужно/i
];

const OBJECT_MUSIC_FORBIDDEN = [
  /музыка у бассейна/i,
  /у бассейна (?:звучит|играет)/i,
  /фонов(?:ая|ую) музык/i,
  /музыка воспроизвод/i
];

function assertNoPoolPayment(text, label) {
  for (const pattern of POOL_PAYMENT_FORBIDDEN) {
    assert.doesNotMatch(text, pattern, `${label}: запрещённая pool-payment формулировка`);
  }
}

function assertNoPoolPaymentInKnowledge(content, label) {
  const poolRelated = content
    .split('\n')
    .filter((line) => /бассейн|бассейном/i.test(line))
    .filter(
      (line) =>
        !/не описыв|не подтвержд|не говор|если гость спрашивает/i.test(line)
    )
    .join('\n');
  if (!poolRelated.trim()) return;
  for (const pattern of POOL_PAYMENT_FORBIDDEN) {
    assert.doesNotMatch(poolRelated, pattern, `${label}: pool-payment в knowledge`);
  }
}

function assertNoObjectMusic(text, label) {
  const lines = text.split('\n').filter((line) => {
    if (/не сообщ|не описыв|не говор/i.test(line)) return false;
    return /музык/i.test(line);
  });
  for (const line of lines) {
    for (const pattern of OBJECT_MUSIC_FORBIDDEN) {
      assert.doesNotMatch(line, pattern, `${label}: утверждение о музыке объекта в «${line.trim()}»`);
    }
  }
}

describe('FAQ pool + quiet hours: пакет №2', () => {
  describe('A. MUSIC / QUIET', () => {
    it('«А вечером можно посидеть с музыкой часов до 12?» — правило тишины, без музыки объекта и входа/выхода', () => {
      const text = 'А вечером можно посидеть с музыкой часов до 12?';
      const result = faq(text);
      assert.equal(result?.data?.intent, 'quiet_hours_music');
      assert.match(result.text, /23:00/);
      assert.match(result.text, /тишин/i);
      assertNoObjectMusic(result.text, 'quiet_hours_music evening');
      assert.doesNotMatch(result.text, /вход|выход|круглосуточ/i);
    });

    it('«А если мы будем негромко, можно музыку до 12?» — запрет даже негромко, без музыки объекта', () => {
      const text = 'А если мы будем негромко, можно музыку до 12?';
      const result = faq(text);
      assert.equal(result?.data?.intent, 'quiet_hours_music');
      assert.match(result.text, /негромк/i);
      assert.match(result.text, /23:00/);
      assertNoObjectMusic(result.text, 'quiet_hours_music quiet');
    });

    it('«Во сколько нужно соблюдать тишину?» — только правило тишины', () => {
      const result = routed('Во сколько нужно соблюдать тишину?');
      assert.equal(result.data.intent, 'quiet_hours');
      assert.match(result.text, /23:00.*08:00|08:00/);
      assertNoObjectMusic(result.text, 'quiet_hours general');
      assert.doesNotMatch(result.text, /вход|выход|круглосуточ/i);
    });
  });

  describe('B. POOL', () => {
    it('«Бассейн есть?» — безопасный pool response', () => {
      const result = routed('Бассейн есть?');
      assert.equal(result.data.intent, 'pool');
      assert.match(result.text, /бассейн/i);
      assert.match(result.text, /подогрева/i);
      assert.match(result.text, /09:00 до 21:00/);
      assertNoPoolPayment(result.text, 'pool exists');
      assertNoObjectMusic(result.text, 'pool exists');
    });

    it('pool FAQ match: «есть бассейн?», «бассейн подогревается?», «до скольки бассейн?»', () => {
      for (const text of ['есть бассейн?', 'бассейн подогревается?', 'до скольки бассейн?']) {
        const result = faq(text);
        assert.equal(result?.data?.intent, 'pool', text);
        assertNoPoolPayment(result.text, text);
      }
    });

    it('guest-facing pool response не содержит payment classification', () => {
      const pool = FAQ_INTENTS.find((item) => item.id === 'pool');
      assertNoPoolPayment(pool.text, 'pool FAQ canned');
      assertNoObjectMusic(pool.text, 'pool FAQ canned');
    });
  });

  describe('C. PAYMENT QUESTIONS', () => {
    for (const text of [
      'Бассейн платный?',
      'За бассейн нужно доплачивать?',
      'Бассейн входит в стоимость?'
    ]) {
      it(`«${text}» — нейтральный факт, без payment classification`, () => {
        const result = routed(text);
        assert.equal(result.data.intent, 'pool_payment', text);
        assert.match(result.text, /09:00 до 21:00/);
        assert.match(result.text, /гост/i);
        assertNoPoolPayment(result.text, text);
      });
    }
  });

  describe('D. REPOSITORY GUARD', () => {
    const guardedFiles = [
      'backend/src/core/faq/answers.js',
      'backend/policies/general_rules.txt',
      'backend/property/pool/description.txt',
      'backend/property/pool/scenarios.txt',
      'backend/src/systemPrompt.js',
      'backend/policies/objections.txt'
    ];

    for (const relPath of guardedFiles) {
      it(`guest-facing sources: ${relPath} без запрещённых music/pool-payment формулировок`, () => {
        const fullPath = path.join(repoRoot, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assertNoObjectMusic(content, relPath);

        if (relPath.includes('objections')) {
          const poolSection = content.split('ПИТАНИЕ В КОМНАТАХ')[0];
          assertNoPoolPaymentInKnowledge(poolSection, `${relPath} (pool section)`);
        } else if (relPath.includes('general_rules')) {
          const poolSection = content.split('ЗАЕЗД И ВЫЕЗД')[0];
          assertNoPoolPaymentInKnowledge(poolSection, `${relPath} (pool section)`);
        } else if (relPath.includes('answers.js')) {
          const poolIntent = FAQ_INTENTS.find((item) => item.id === 'pool');
          const poolPaymentIntent = FAQ_INTENTS.find((item) => item.id === 'pool_payment');
          assertNoPoolPayment(poolIntent.text, 'pool FAQ');
          assertNoPoolPayment(poolPaymentIntent.text, 'pool_payment FAQ');
        } else {
          assertNoPoolPaymentInKnowledge(content, relPath);
        }
      });
    }
  });
});
