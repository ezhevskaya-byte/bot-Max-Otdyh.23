import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMaxText } from '../src/core/channel/max-format.js';
import {
  getCompositionClarificationResponse,
  needsGuestCompositionClarification
} from '../src/core/guest-context/composition-gate.js';
import { emptyGuestProfile, extractGuestFacts } from '../src/core/guest-context/profile.js';
import { routeMessage, routeThenMaybeAskAI } from '../src/core/router.js';
import { buildRoomSelectionHint } from '../src/room-sales-logic.js';
import { SALES_CORE } from '../src/core/knowledge/system-core.js';
import { buildLlmSystemPrompt } from '../src/core/knowledge/prompt.js';
import { formatRoomPhotoMessage, findRoomLink } from '../src/room-links.js';

const COMFORT_RECOMMENDATION =
  'Для вашего состава хорошо подойдёт категория «Комфорт». Могу также показать фотографии этой комнаты.';

describe('MAX: sanitize markdown links', () => {
  it('преобразует Markdown-ссылку в чистый URL', () => {
    const input = '[https://otdyh23.ru/](https://otdyh23.ru/)';
    const output = sanitizeMaxText(input);
    assert.equal(output, 'https://otdyh23.ru/');
    assert.doesNotMatch(output, /\[|\]\(/);
  });

  it('не повреждает уже чистый URL', () => {
    const url = 'https://otdyh23.ru/?room=comfort&scenario=comfort-3#rooms';
    assert.equal(sanitizeMaxText(url), url);
  });

  it('оставляет обычный текст без изменений', () => {
    const text = 'Конечно, помогу подобрать удобный вариант.';
    assert.equal(sanitizeMaxText(text), text);
  });
});

describe('composition gate: сначала состав гостей', () => {
  it('«Нужен номер на 3 человек» → спрашивает состав, не рекомендует комнату', async () => {
    const text = 'Нужен номер на 3 человек';
    const profile = emptyGuestProfile();

    assert.equal(needsGuestCompositionClarification(profile, text), true);

    const clarification = getCompositionClarificationResponse(text, profile, []);
    assert.match(clarification, /взросл/i);
    assert.match(clarification, /дети/i);
    assert.doesNotMatch(clarification, /комфорт/i);
    assert.doesNotMatch(clarification, /делюкс/i);

    let providerCalled = false;
    const result = await routeThenMaybeAskAI({
      text,
      history: [],
      guestProfile: profile,
      askAI: async () => {
        providerCalled = true;
        return 'Не должно вызываться';
      }
    });

    assert.equal(providerCalled, false);
    assert.equal(result.data?.compositionGate, true);
    assert.match(result.text, /здравств/i);
    assert.match(result.text, /взросл|состав/i);
  });

  it('после уточнения состава gate не срабатывает', () => {
    const profile = { ...emptyGuestProfile(), adults: 2, children: 1, childrenAges: [6] };
    assert.equal(
      needsGuestCompositionClarification(profile, 'нужен номер на 3 человек'),
      false
    );
  });
});

describe('sales hints: без негативных формулировок', () => {
  it('buildRoomSelectionHint не содержит «компактн»', () => {
    const hint = buildRoomSelectionHint('нужен номер на 3 человек', [], emptyGuestProfile());
    assert.doesNotMatch(hint.toLowerCase(), /компактн/);
  });

  it('SALES_CORE запрещает негативные формулировки и требует CTA', () => {
    assert.match(SALES_CORE, /компактн/i);
    assert.match(SALES_CORE, /следующий шаг/i);
    assert.match(SALES_CORE, /не обещать наличие/i);
  });
});

describe('room-specific URL для фото', () => {
  it('запрос фото рекомендованной категории → room-specific URL', () => {
    const routed = routeMessage({
      text: 'да',
      context: {
        lastAssistantText:
          'Для такого состава хорошо подойдёт категория «Комфорт». Хотите, покажу фотографии этой категории?'
      }
    });

    assert.equal(routed.type, 'room-link');
    assert.match(routed.text, /Комфорт/);
    assert.match(routed.data.url, /room=comfort/);
    assert.doesNotMatch(routed.data.url, /^https:\/\/otdyh23\.ru\/$/);
    assert.doesNotMatch(routed.text, /otdyh23\.ru\/$/);
  });

  it('прямой запрос ссылки на комнату → room-specific URL', () => {
    const routed = routeMessage({
      text: 'дайте ссылку на комфорт для троих',
      context: { lastAssistantText: '' }
    });

    assert.equal(routed.type, 'room-link');
    assert.equal(
      routed.data.url,
      'https://otdyh23.ru/?room=comfort&scenario=comfort-3#rooms'
    );
  });
});

describe('profile-aware Comfort scenario', () => {
  it('A. partySize=3 + «Можно фото» после Comfort → comfort-3', () => {
    const routed = routeMessage({
      text: 'Можно фото',
      context: {
        lastAssistantText: COMFORT_RECOMMENDATION,
        guestProfile: { adults: 2, children: 1, partySize: 3 }
      }
    });

    assert.equal(routed.type, 'room-link');
    assert.match(routed.data.url, /room=comfort/);
    assert.match(routed.data.url, /scenario=comfort-3/);
    assert.equal(
      routed.data.url,
      'https://otdyh23.ru/?room=comfort&scenario=comfort-3#rooms'
    );
  });

  it('B. «для трёх гостей» → comfort-3', () => {
    const routed = routeMessage({ text: 'покажите фото комфорт для трёх гостей' });
    assert.equal(routed.data.scenario_id, 'comfort-3');
    assert.match(routed.data.url, /scenario=comfort-3/);
  });

  it('C. «для трех гостей» → comfort-3', () => {
    const routed = routeMessage({ text: 'покажите фото комфорт для трех гостей' });
    assert.equal(routed.data.scenario_id, 'comfort-3');
    assert.match(routed.data.url, /scenario=comfort-3/);
  });

  it('D. 2 взрослых, children=0, partySize=2 → comfort-2', () => {
    const routed = routeMessage({
      text: 'Можно фото',
      context: {
        lastAssistantText: COMFORT_RECOMMENDATION,
        guestProfile: { adults: 2, children: 0, partySize: 2 }
      }
    });

    assert.equal(routed.data.scenario_id, 'comfort-2');
    assert.match(routed.data.url, /scenario=comfort-2/);
  });

  it('E. явный запрос детской кроватки имеет приоритет → comfort-cot', () => {
    const routed = routeMessage({
      text: 'Можно фото с детской кроваткой',
      context: {
        lastAssistantText: COMFORT_RECOMMENDATION,
        guestProfile: { adults: 2, children: 1, partySize: 3 }
      }
    });

    assert.equal(routed.data.scenario_id, 'comfort-cot');
    assert.match(routed.data.url, /scenario=comfort-cot/);
  });

  it('F. «два взрослых один ребёнок семь лет» → 2+1, возраст 7, partySize=3', () => {
    const facts = extractGuestFacts('два взрослых один ребёнок семь лет');
    assert.equal(facts.adults, 2);
    assert.equal(facts.children, 1);
    assert.deepEqual(facts.childrenAges, [7]);
    assert.equal(facts.partySize, 3);
  });

  it('G. «два взрослых один ребёнок 7 лет» продолжает работать', () => {
    const facts = extractGuestFacts('два взрослых один ребёнок 7 лет');
    assert.equal(facts.adults, 2);
    assert.equal(facts.children, 1);
    assert.deepEqual(facts.childrenAges, [7]);
    assert.equal(facts.partySize, 3);
  });

  it('H. CTA после фото не повторяет состав и не обещает наличие', () => {
    const routed = routeMessage({
      text: 'Можно фото',
      context: {
        lastAssistantText: COMFORT_RECOMMENDATION,
        guestProfile: { adults: 2, children: 1, partySize: 3 }
      }
    });

    assert.doesNotMatch(
      routed.text,
      /насколько этот вариант подойдёт именно вашему составу гостей/
    );
    assert.doesNotMatch(routed.text, /есть свободн|свободно|наличие подтвержд|точно есть/i);
    assert.match(routed.text, /дат/i);
    assert.match(routed.text, /следующ/i);

    const message = formatRoomPhotoMessage(findRoomLink('comfort', 'comfort-3'));
    assert.doesNotMatch(
      message,
      /насколько этот вариант подойдёт именно вашему составу гостей/
    );
    assert.match(
      message,
      /Если вариант вам понравится, подскажите даты поездки/
    );
  });
});

describe('LLM system prompt: правила достоверности', () => {
  it('не содержит слова «компактн» в sales-блоке как рекомендацию', () => {
    const system = buildLlmSystemPrompt({
      knowledgeContext: 'Тестовый контекст.',
      roomSelectionHint: buildRoomSelectionHint('номер на 3', [], emptyGuestProfile())
    });

    const salesSection = system.split('КОНТЕКСТ ЗНАНИЙ')[0];
    assert.match(salesSection, /ЗАПРЕЩЁННЫЕ ФОРМУЛИРОВКИ/i);
    assert.doesNotMatch(
      buildRoomSelectionHint('дешевле', [], emptyGuestProfile()).toLowerCase(),
      /компактн/
    );
  });
});
