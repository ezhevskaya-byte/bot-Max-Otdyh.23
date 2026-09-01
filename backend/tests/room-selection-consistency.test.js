import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  retrieveKnowledge,
  selectRoomSections,
  ROOM_SECTIONS
} from '../src/core/knowledge/index.js';
import {
  buildRoomFolderLiveKnowledge,
  selectRelevantScenarioText
} from '../src/core/knowledge/room-live.js';
import { emptyGuestProfile, extractGuestFacts, mergeGuestProfile } from '../src/core/guest-context/profile.js';
import {
  getCompositionClarificationResponse,
  needsGuestCompositionClarification
} from '../src/core/guest-context/composition-gate.js';
import { routeMessage } from '../src/core/router.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAMILY_SCENARIOS = readFileSync(
  join(__dirname, '../rooms/family_room/scenarios.txt'),
  'utf-8'
);

function firstSection(sections) {
  return sections.filter((id) => id !== ROOM_SECTIONS.GENERAL_RULES)[0];
}

describe('пакет №4.1: room-selection consistency', () => {
  it('A. «Нас четверо взрослых» → первым не Family, подходящий Deluxe', () => {
    const profile = extractGuestFacts('Нас четверо взрослых');
    const sections = selectRoomSections({
      normalized: 'нас четверо взрослых',
      guestProfile: profile
    });
    assert.notEqual(firstSection(sections), ROOM_SECTIONS.FAMILY);
    assert.equal(sections.includes(ROOM_SECTIONS.DELUXE_2), true);
    assert.equal(sections.includes(ROOM_SECTIONS.DELUXE_3), true);
    assert.equal(sections.includes(ROOM_SECTIONS.FAMILY), false);

    const live = buildRoomFolderLiveKnowledge('deluxe_2floor', {
      guestProfile: profile,
      normalized: 'нас четверо взрослых'
    });
    assert.match(live, /Четверо взрослых/i);
    assert.doesNotMatch(live, /сначала предлагать.*Семейную/i);
  });

  it('B. «Один взрослый и двое детей 6 и 8 лет» → без «2 взрослых + ребёнок»', () => {
    const text = 'Один взрослый и двое детей 6 и 8 лет';
    const profile = extractGuestFacts(text);
    assert.equal(profile.adults, 1);
    assert.equal(profile.children, 2);

    const comfort = buildRoomFolderLiveKnowledge('comfort_2floor', {
      guestProfile: profile,
      normalized: text
    });
    const describe = comfort.match(/Как описывать:\s*«([^»]+)»/);
    assert.ok(describe, 'ожидали блок «Как описывать»');
    assert.doesNotMatch(describe[1], /2 взрослых и ребёнок/i);
    assert.doesNotMatch(describe[1], /Двое взрослых \+ ребёнок/i);

    const deluxe = buildRoomFolderLiveKnowledge('deluxe_2floor', {
      guestProfile: profile,
      normalized: text
    });
    assert.doesNotMatch(deluxe, /2 взрослых и ребёнок/i);
    assert.doesNotMatch(deluxe, /Двое взрослых \+ ребёнок/i);
  });

  it('C. «Нас семья из 5 человек» → уточнение состава, без Family scenario для 2 гостей', () => {
    const text = 'Нас семья из 5 человек';
    const profile = extractGuestFacts(text);
    assert.equal(profile.partySize, 5);
    assert.equal(profile.adults, null);

    assert.equal(needsGuestCompositionClarification(profile, text), true);
    const clar = getCompositionClarificationResponse(text, profile);
    assert.match(clar, /сколько среди вас взрослых и детей/i);

    const sections = selectRoomSections({
      normalized: text,
      guestProfile: profile
    });
    assert.equal(sections.includes(ROOM_SECTIONS.FAMILY), false);

    const filtered = selectRelevantScenarioText(FAMILY_SCENARIOS, {
      folder: 'family_room',
      guestProfile: profile,
      normalized: text
    });
    assert.doesNotMatch(filtered, /1\.\s+Размещение 2 гостей/i);
    assert.doesNotMatch(filtered, /Как описывать:[\s\S]*2 гост/i);
  });

  it('D. после уточнения «2 взрослых и дети 5, 8 и 11 лет» → Family, сценарий до 5 гостей', () => {
    const history = [{ role: 'user', content: 'Нас семья из 5 человек' }];
    const text = '2 взрослых и дети 5, 8 и 11 лет';
    let profile = emptyGuestProfile();
    for (const message of history) {
      profile = mergeGuestProfile(profile, extractGuestFacts(message.content));
    }
    profile = mergeGuestProfile(profile, extractGuestFacts(text));

    assert.equal(profile.adults, 2);
    assert.equal(profile.children, 3);
    assert.deepEqual(profile.childrenAges, [5, 8, 11]);
    assert.equal(needsGuestCompositionClarification(profile, text), false);

    const sections = selectRoomSections({
      normalized: text,
      guestProfile: profile
    });
    assert.equal(firstSection(sections), ROOM_SECTIONS.FAMILY);

    const family = buildRoomFolderLiveKnowledge('family_room', {
      guestProfile: profile,
      normalized: text
    });
    assert.match(family, /до 5 гостей/i);
    assert.doesNotMatch(family, /1\.\s+Размещение 2 гостей/i);
  });

  it('E. «Мы вдвоём, хотим вариант попросторнее» → Deluxe, Family не первым', () => {
    const text = 'Мы вдвоём, хотим вариант попросторнее';
    const profile = extractGuestFacts(text);
    const sections = selectRoomSections({
      normalized: text,
      guestProfile: profile
    });
    assert.equal(firstSection(sections), ROOM_SECTIONS.COMFORT);
    assert.equal(sections.includes(ROOM_SECTIONS.DELUXE_2), true);
    assert.equal(sections.includes(ROOM_SECTIONS.FAMILY), false);
  });

  it('F. «Мы вдвоём, хотим большой балкон» → Deluxe 3', () => {
    const text = 'Мы вдвоём, хотим большой балкон';
    const profile = extractGuestFacts(text);
    const sections = selectRoomSections({
      normalized: text,
      guestProfile: profile
    });
    assert.equal(firstSection(sections), ROOM_SECTIONS.DELUXE_3);
    assert.equal(sections.includes(ROOM_SECTIONS.COMFORT), false);
  });
});

describe('пакет №4.2: baby_cot room-selection routing', () => {
  it('1. «У вас есть детская кроватка?» → FAQ baby_cot', () => {
    const routed = routeMessage({ text: 'У вас есть детская кроватка?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'baby_cot');
  });

  it('2. «Кроватку предоставляете?» → FAQ baby_cot', () => {
    const routed = routeMessage({ text: 'Кроватку предоставляете?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.data.intent, 'baby_cot');
  });

  it('3. подбор + состав + кроватка → AI, не FAQ baby_cot', () => {
    const routed = routeMessage({
      text: 'Нас двое взрослых и ребёнок 2 лет, нужна кроватка. Какой номер нам подойдёт?'
    });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });

  it('4. «2 взрослых и малыш 2 лет… Что посоветуете?» → AI', () => {
    const routed = routeMessage({
      text: '2 взрослых и малыш 2 лет, нужна кроватка. Что посоветуете?'
    });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });

  it('5. «Какой номер выбрать с ребёнком 2 лет и кроваткой?» → AI', () => {
    const routed = routeMessage({
      text: 'Какой номер выбрать с ребёнком 2 лет и кроваткой?'
    });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });

  it('6. deluxe_large_balcony: справочный и подбор — без регрессии', () => {
    const faq = routeMessage({ text: 'Есть номера с большим балконом?' });
    assert.equal(faq.handled, true);
    assert.equal(faq.data.intent, 'deluxe_large_balcony');

    const ai = routeMessage({
      text: 'Нас двое, хотим номер с большим балконом. Что посоветуете?'
    });
    assert.equal(ai.handled, false);
    assert.equal(ai.type, 'ai');
  });
});

describe('пакет №4.1: FAQ routing diagnostic (без изменений deluxe_large_balcony)', () => {
  it('baby_cot: справочный вопрос → FAQ', () => {
    const routed = routeMessage({ text: 'У вас есть детская кроватка?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.type, 'faq');
    assert.equal(routed.data.intent, 'baby_cot');
  });

  it('baby_cot: подбор номера + кроватка → AI room-selection', () => {
    const routed = routeMessage({
      text: 'Нас двое взрослых и ребёнок 2 лет, нужна кроватка. Какой номер нам подойдёт?'
    });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });

  it('deluxe_large_balcony: справочный вопрос → FAQ', () => {
    const routed = routeMessage({ text: 'Есть номера с большим балконом?' });
    assert.equal(routed.handled, true);
    assert.equal(routed.data.intent, 'deluxe_large_balcony');
  });

  it('deluxe_large_balcony: подбор + балкон → сейчас уходит в AI, не в FAQ', () => {
    const routed = routeMessage({
      text: 'Нас двое, хотим номер с большим балконом. Что посоветуете?'
    });
    assert.equal(routed.handled, false);
    assert.equal(routed.type, 'ai');
  });
});
