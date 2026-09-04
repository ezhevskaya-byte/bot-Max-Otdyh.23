import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  retrieveKnowledge,
  prepareAiFallbackCall,
  buildLlmSystemPrompt,
  buildRoomSectionsContext,
  selectRoomSections,
  ROOM_SECTIONS,
  SALES_CORE,
  TOPICS
} from '../src/core/knowledge/index.js';
import {
  buildRoomFolderLiveKnowledge,
  hasReliableComposition,
  selectRelevantScenarioText
} from '../src/core/knowledge/room-live.js';
import { clearGuestContexts, emptyGuestProfile } from '../src/core/guest-context/index.js';
import { needsGuestCompositionClarification } from '../src/core/guest-context/composition-gate.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeMessage } from '../src/core/router.js';
import { buildRoomSelectionHint } from '../src/room-sales-logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMFORT_SCENARIOS = readFileSync(
  join(__dirname, '../rooms/comfort_2floor/scenarios.txt'),
  'utf-8'
);

function hasRoom(result, section) {
  return result.roomSections.includes(section);
}

describe('sales package: live knowledge без обесценивания Comfort', () => {
  it('1. live Comfort knowledge не содержит обесценивающего «компактн»', () => {
    const live = buildRoomFolderLiveKnowledge('comfort_2floor', {
      guestProfile: { ...emptyGuestProfile(), adults: 2, children: 1, childrenAges: [7] },
      normalized: '2 взрослых и ребёнок 7 лет'
    });
    assert.doesNotMatch(live.toLowerCase(), /компактн/);
    assert.match(live, /Как описывать/i);
  });

  it('2. 2 взрослых + ребёнок 7 лет → Comfort + Deluxe, не только Comfort+Family', () => {
    const result = retrieveKnowledge({
      text: '2 взрослых и ребёнок 7 лет'
    });
    assert.equal(hasRoom(result, ROOM_SECTIONS.COMFORT), true);
    assert.equal(
      hasRoom(result, ROOM_SECTIONS.DELUXE_2) || hasRoom(result, ROOM_SECTIONS.DELUXE_3),
      true
    );
    // Family не обязательна без запроса простора
    assert.equal(hasRoom(result, ROOM_SECTIONS.FAMILY), false);
  });

  it('3. в одном live prompt нет конфликта «не компактный» vs «Comfort компактный»', () => {
    const prepared = prepareAiFallbackCall({
      text: '2 взрослых и ребёнок 7 лет',
      channel: 'test',
      guestId: 'sales-pkg-conflict'
    });
    const system = prepared.system.toLowerCase();
    const forbidsCompact = /не используй[\s\S]{0,120}компактн/.test(system);
    const recommendsCompactComfort =
      /комфорт[\s\S]{0,40}компактн|компактн[\s\S]{0,40}комфорт/.test(system);
    assert.equal(forbidsCompact, true);
    assert.equal(recommendsCompactComfort, false);
  });

  it('4. при известном составе не передаются все сценарии Comfort без необходимости', () => {
    const profile = {
      ...emptyGuestProfile(),
      adults: 2,
      children: 1,
      childrenAges: [7],
      partySize: 3
    };
    assert.equal(hasReliableComposition(profile, '2 взрослых и ребёнок 7 лет'), true);
    const filtered = selectRelevantScenarioText(COMFORT_SCENARIOS, {
      folder: 'comfort_2floor',
      guestProfile: profile,
      normalized: '2 взрослых и ребёнок 7 лет'
    });
    // Сценарий 3 (2+1 от 5 лет) есть; сценарий 1 (пара) и 5 (малыш/кроватка) — нет
    assert.match(filtered, /Двое взрослых \+ ребёнок от 5 лет/i);
    assert.doesNotMatch(filtered, /1\.\s+Один гость или двое взрослых/i);
    assert.doesNotMatch(filtered, /5\.\s+Семья с малышом до 4 лет/i);
    const scenarioHeads = (filtered.match(/^\d+\.\s+/gm) || []).length;
    assert.ok(scenarioHeads <= 2, `ожидали ≤2 сценария, получили ${scenarioHeads}`);
  });

  it('5. в prompt есть релевантный блок «Как описывать» выбранного сценария', () => {
    const live = buildRoomFolderLiveKnowledge('comfort_2floor', {
      guestProfile: {
        ...emptyGuestProfile(),
        adults: 2,
        children: 1,
        childrenAges: [7]
      },
      normalized: 'два взрослых и ребёнок 7 лет'
    });
    assert.match(live, /Как описывать/i);
    assert.match(live, /двуспальная кровать|отдельное полноценное/i);
  });

  it('6. при неполном составе scenario не угадывается преждевременно', () => {
    const profile = { ...emptyGuestProfile(), partySize: 3 };
    assert.equal(hasReliableComposition(profile, 'нужен номер на три человека'), false);
    const all = selectRelevantScenarioText(COMFORT_SCENARIOS, {
      folder: 'comfort_2floor',
      guestProfile: profile,
      normalized: 'нужен номер на три человека'
    });
    // Без надёжного состава — все нумерованные сценарии остаются
    const heads = (all.match(/^\d+\.\s+/gm) || []).length;
    assert.ok(heads >= 5, `ожидали полный набор сценариев, получили ${heads}`);
  });

  it('7. 3 взрослых не получают жёсткое «только Family / две комнаты»', () => {
    const sections = selectRoomSections({
      normalized: 'трое взрослых',
      guestProfile: { ...emptyGuestProfile(), adults: 3, children: 0, partySize: 3 }
    });
    assert.equal(sections.includes(ROOM_SECTIONS.COMFORT), true);
    assert.equal(
      sections.includes(ROOM_SECTIONS.DELUXE_2) || sections.includes(ROOM_SECTIONS.DELUXE_3),
      true
    );
    const context = buildRoomSectionsContext(sections, {
      guestProfile: { ...emptyGuestProfile(), adults: 3, children: 0, partySize: 3 },
      normalized: 'трое взрослых'
    });
    assert.doesNotMatch(
      context,
      /3 взрослых[\s\S]{0,40}только Family|3 взрослых[\s\S]{0,80}только «Семейная»|трое взрослых[\s\S]{0,40}обязательно две комнаты/i
    );
    assert.match(context, /Комфорт|Comfort/i);
  });

  it('7b. 4 взрослых: семья vs не семья, приоритеты', () => {
    const friends = buildRoomSelectionHint(
      'нас четверо взрослых друзей',
      [],
      { ...emptyGuestProfile(), adults: 4, children: 0, partySize: 4, groupType: 'friends' }
    );
    assert.match(friends, /ЧЕТЫРЁХ ВЗРОСЛЫХ|характер компании/i);
    assert.match(friends, /ЗАПРЕЩЕНО рекомендовать один|не рекомендовать один/i);
    assert.match(friends, /Делюкс.*первым|первым вариантом/i);
    assert.match(friends, /Две отдельные комнаты|два отдельных номера|две комнаты/i);
    assert.match(friends, /обычно для такой компании удобнее|своё пространство|заботу о комфорте/i);
    assert.doesNotMatch(friends.toLowerCase(), /компактн/);

    const family = buildRoomSelectionHint(
      'нас четверо взрослых, одна семья, родители и взрослые дети',
      [],
      { ...emptyGuestProfile(), adults: 4, children: 0, partySize: 4, groupType: 'family' }
    );
    assert.match(family, /ОДНА СЕМЬЯ|Семейную/i);
    assert.match(family, /две отдельные жилые зоны|две жилые зоны/i);

    const together = buildRoomSelectionHint(
      'хотим жить все вместе в одном номере',
      [{ role: 'user', content: 'нас четверо взрослых друзей' }],
      { ...emptyGuestProfile(), adults: 4, children: 0, partySize: 4, groupType: 'friends' }
    );
    assert.match(together, /Семейная/i);
    assert.match(together, /компромисс/i);
  });

  it('8. ограничения по кроватке сохраняются', () => {
    const result = retrieveKnowledge({
      text: '4 гостя в Делюкс + нужна кроватка'
    });
    assert.equal(result.topics.includes(TOPICS.BABY_COT), true);
    assert.match(result.context, /не устанавливаем/i);
    assert.match(result.context, /Семейную|Семейной/i);
  });

  it('9. фактическое отличие балконов Deluxe 2 / Deluxe 3 сохраняется', () => {
    const d2 = buildRoomFolderLiveKnowledge('deluxe_2floor', {
      guestProfile: { ...emptyGuestProfile(), adults: 2, children: 0, partySize: 2 },
      normalized: 'двое взрослых'
    });
    const d3 = buildRoomFolderLiveKnowledge('deluxe_3floor', {
      guestProfile: { ...emptyGuestProfile(), adults: 2, children: 0, partySize: 2 },
      normalized: 'двое взрослых'
    });
    assert.match(d2, /французск/i);
    assert.match(d3, /уличн|больш/i);
  });

  it('10. точечный вопрос об оснащении сохраняет фактическую информацию', () => {
    const result = retrieveKnowledge({ text: 'есть ли кондиционер в Комфорт?' });
    assert.match(result.context.toLowerCase(), /кондиционер/);
  });

  it('11. composition gate не сломан', () => {
    const incomplete = { ...emptyGuestProfile(), partySize: 3 };
    assert.equal(
      needsGuestCompositionClarification(incomplete, 'Нужен номер на три человека'),
      true
    );
    const complete = {
      ...emptyGuestProfile(),
      adults: 2,
      children: 1,
      childrenAges: [7],
      partySize: 3
    };
    assert.equal(
      needsGuestCompositionClarification(complete, 'Два взрослых и ребёнок 7 лет'),
      false
    );
  });

  it('12. room-specific URL / photo route не сломан пакетом', () => {
    const routed = routeMessage({
      text: 'покажи комфорт для двоих',
      context: { lastAssistantText: '' }
    });
    assert.equal(routed.type, 'room-link');
    assert.match(routed.data.url, /room=comfort/);
  });
});

describe('sales package: SALES_CORE приоритет структуры ответа', () => {
  beforeEach(() => {
    clearGuestContexts();
  });

  it('SALES_CORE требует 2–4 преимущества и запрещает каталог', () => {
    assert.match(SALES_CORE, /2–4|2-4/);
    assert.match(SALES_CORE, /Как описывать/i);
    assert.match(SALES_CORE, /не перечисляй|каталог/i);
    assert.ok(SALES_CORE.length < 2500);
  });

  it('prepareAiFallbackCall для 2+1 даёт Comfort+Deluxe и меньший dump сценариев', () => {
    const prepared = prepareAiFallbackCall({
      text: 'Два взрослых и ребёнок 7 лет',
      channel: 'test',
      guestId: 'sales-pkg-2plus1'
    });
    const { roomSections, knowledgeChars, systemChars } = prepared.diagnostics;
    assert.ok(roomSections.includes(ROOM_SECTIONS.COMFORT));
    assert.ok(
      roomSections.includes(ROOM_SECTIONS.DELUXE_2) ||
        roomSections.includes(ROOM_SECTIONS.DELUXE_3)
    );
    assert.match(prepared.system, /Как описывать/i);
    assert.doesNotMatch(prepared.system.toLowerCase(), /комфорт[\s\S]{0,40}компактн/);
    // Регрессия размера: knowledge заметно меньше полного dump (~17k ранее)
    assert.ok(knowledgeChars < 14000, `knowledgeChars=${knowledgeChars}`);
    assert.ok(systemChars < 20000, `systemChars=${systemChars}`);
  });
});
