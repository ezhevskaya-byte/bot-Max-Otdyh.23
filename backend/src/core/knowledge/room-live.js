/**
 * Live-сборка знаний о комнате для LLM:
 * — компактные факты из room.json (без сырого JSON);
 * — атмосфера из description (без inventory-списка);
 * — релевантные сценарии + «Как описывать» + ВАЖНЫЕ ПРАВИЛА.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { includesAny } from '../text-normalize.js';
import { emptyGuestProfile, guestPartySize } from '../guest-context/profile.js';
import { BACKEND_ROOT, joinSections, readTextFileSafe } from './loader.js';

function readJsonSafe(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function youngestChildAge(profile) {
  const ages = profile?.childrenAges || [];
  if (!ages.length) return null;
  return Math.min(...ages);
}

function needsBabyCot(normalized, profile) {
  if (profile?.babyCot === true) return true;
  if (includesAny(normalized, ['кроватк', 'манеж'])) return true;
  const age = youngestChildAge(profile);
  return age != null && age <= 4;
}

function wantsTwinBeds(normalized) {
  return includesAny(normalized, [
    'раздельн',
    'отдельн',
    'две кровати',
    '2 кровати',
    'два отдельных',
    'две односпальн'
  ]);
}

/**
 * Надёжный состав для выбора scenario: взрослые+дети или явный partySize с деталями.
 * Общее «трое гостей» без взрослых/детей — недостаточно (composition gate).
 */
export function hasReliableComposition(profile, normalized = '') {
  const current = profile || emptyGuestProfile();
  if (current.adults != null && current.children != null) return true;
  if (current.adults != null && current.childrenAges?.length) return true;
  if (
    current.partySize != null &&
    (current.children != null ||
      current.childrenAges?.length ||
      needsBabyCot(normalized, current) ||
      includesAny(normalized, ['взросл', 'ребен', 'дет']))
  ) {
    return true;
  }
  return false;
}

export function formatCompactRoomFacts(room, { includeEquipment = false } = {}) {
  if (!room || typeof room !== 'object') return '';

  const lines = ['КРАТКИЕ ФАКТЫ КАТЕГОРИИ:'];
  if (room.name) lines.push(`Название: ${room.name}`);
  if (room.floor != null) lines.push(`Этаж: ${room.floor}`);
  if (room.area_m2 != null) lines.push(`Площадь: ${room.area_m2} м²`);
  if (room.capacity) {
    const max = room.capacity.max ?? room.capacity.recommended_max;
    const min = room.capacity.min;
    lines.push(`Вместимость: ${min != null ? `от ${min} ` : ''}до ${max} гостей`);
  }
  if (room.balcony?.description) {
    lines.push(`Балкон: ${room.balcony.description}`);
  }
  if (room.zones?.description) {
    lines.push(`Зоны: ${room.zones.description}`);
  }
  if (room.view) lines.push(`Вид: ${room.view}`);
  if (room.bathroom?.private) lines.push('Санузел: собственный');

  const layouts = Array.isArray(room.layouts) ? room.layouts : [];
  if (layouts.length) {
    lines.push('Варианты размещения:');
    for (const layout of layouts) {
      const suit = Array.isArray(layout.suitable_for)
        ? layout.suitable_for.join(', ')
        : '';
      lines.push(
        `— ${layout.title || layout.id} (до ${layout.capacity} гост.)${suit ? `: ${suit}` : ''}`
      );
    }
  }

  if (room.rules && typeof room.rules === 'object') {
    lines.push('Ограничения (из правил категории):');
    for (const [key, value] of Object.entries(room.rules)) {
      lines.push(`— ${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
    }
  }

  const equipment = [
    ...(Array.isArray(room.equipment) ? room.equipment : []),
    ...(Array.isArray(room.guest_items) ? room.guest_items : [])
  ];
  if (equipment.length && includeEquipment) {
    lines.push(
      'ОСНАЩЕНИЕ (использовать при прямом вопросе гостя; не перечислять целиком в продажном ответе):'
    );
    lines.push(`— ${equipment.join('; ')}`);
  }

  return lines.join('\n');
}

function asksAboutEquipment(normalized = '') {
  return includesAny(normalized, [
    'кондиционер',
    'телевизор',
    'фен',
    'холодильник',
    'сейф',
    'wi-fi',
    'wifi',
    'вайфай',
    'оснащен',
    'оборудован',
    'что есть в комнат',
    'есть ли'
  ]);
}

/**
 * Атмосфера и особенности без inventory-списков «В комнате / Для гостей / На территории».
 */
export function extractAtmosphereFromDescription(description) {
  const text = String(description || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return '';

  const skipHeads = [
    'В комнате:',
    'Для гостей предоставляется:',
    'На территории гостевого дома:'
  ];

  const lines = text.split('\n');
  const kept = [];
  let skippingList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (skipHeads.some((h) => trimmed.startsWith(h))) {
      skippingList = true;
      continue;
    }
    if (skippingList) {
      if (trimmed.startsWith('—') || trimmed.startsWith('-') || trimmed === '') {
        continue;
      }
      skippingList = false;
    }
    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitScenarioBlocks(scenariosText) {
  const text = String(scenariosText || '').replace(/\r\n/g, '\n');
  const rulesMatch = text.match(/\nВАЖНЫЕ ПРАВИЛА[\s\S]*$/);
  const rules = rulesMatch ? rulesMatch[0].trim() : '';
  const body = rulesMatch ? text.slice(0, rulesMatch.index) : text;

  const parts = body.split(/\n(?=\d+\.\s+)/);
  const header = [];
  const blocks = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const numMatch = trimmed.match(/^(\d+)\.\s+/);
    if (!numMatch) {
      header.push(trimmed);
      continue;
    }
    blocks.push({
      number: Number(numMatch[1]),
      text: trimmed
    });
  }

  return { header: header.join('\n\n').trim(), blocks, rules };
}

function pickScenarioNumbers(folder, profile, normalized) {
  const current = profile || emptyGuestProfile();
  const size = guestPartySize(current, normalized);
  const adults = current.adults;
  const children = current.children;
  const age = youngestChildAge(current);
  const cot = needsBabyCot(normalized, current);
  const twin = wantsTwinBeds(normalized);

  if (folder === 'comfort_2floor') {
    if (cot && twin) return [6];
    if (cot || (age != null && age <= 4)) return [5];
    if (adults === 3 || (size === 3 && children === 0)) return [4, 7];
    if (
      (adults === 2 && children === 1) ||
      (size === 3 && (age == null || age >= 5)) ||
      (size === 3 && children == null && includesAny(normalized, ['троих', 'трёх', 'трех', '3 гост']))
    ) {
      return twin ? [2, 3] : [3];
    }
    if (twin) return [2];
    if (size === 2 || size === 1 || (adults != null && adults <= 2 && (children === 0 || children == null))) {
      return [1];
    }
    return null;
  }

  if (folder === 'deluxe_2floor' || folder === 'deluxe_3floor') {
    if (cot && (size == null || size <= 3)) return [6];
    if (adults === 4 || (size === 4 && children === 0 && includesAny(normalized, ['взросл']))) {
      return [5];
    }
    if (size === 4 || (adults != null && (adults || 0) + (children || 0) === 4)) return [4];
    if (
      size === 3 ||
      (adults === 2 && children === 1) ||
      includesAny(normalized, ['троих', 'трёх', '3 гост'])
    ) {
      return twin ? [2, 3] : [3];
    }
    if (twin) return [2];
    if (size === 2 || size === 1 || (adults != null && adults <= 2 && (children === 0 || children == null))) {
      return [1];
    }
    return null;
  }

  if (folder === 'family_room') {
    if (cot || (age != null && age <= 4)) return [4];
    if (size === 5 || adults === 5 || includesAny(normalized, ['пятеро', '5 гост', 'пять'])) {
      return friendsOrFiveAdults(normalized, current) ? [3, 5] : [3];
    }
    if (size === 3 || size === 4 || (adults === 2 && (children === 1 || children === 2))) {
      return [2];
    }
    if (size === 2 || size === 1) return [1];
    return null;
  }

  return null;
}

function friendsOrFiveAdults(normalized, profile) {
  return (
    profile?.groupType === 'friends' ||
    includesAny(normalized, ['друз', 'компани', 'взрослых'])
  );
}

export function selectRelevantScenarioText(scenariosText, { folder, guestProfile, normalized } = {}) {
  const { header, blocks, rules } = splitScenarioBlocks(scenariosText);
  if (!blocks.length) {
    return String(scenariosText || '').trim();
  }

  const reliable = hasReliableComposition(guestProfile, normalized);
  const numbers = reliable ? pickScenarioNumbers(folder, guestProfile, normalized) : null;

  let chosen = blocks;
  if (numbers && numbers.length) {
    const filtered = blocks.filter((b) => numbers.includes(b.number));
    if (filtered.length) chosen = filtered;
  }

  return joinSections([
    header,
    ...chosen.map((b) => b.text),
    rules
  ]);
}

export function buildRoomFolderLiveKnowledge(folder, options = {}) {
  const folderPath = join(BACKEND_ROOT, 'rooms', folder);
  if (!existsSync(folderPath)) return '';

  const room = readJsonSafe(join(folderPath, 'room.json'));
  const description = readTextFileSafe(join(folderPath, 'description.txt'));
  const scenarios = readTextFileSafe(join(folderPath, 'scenarios.txt'));

  const facts = formatCompactRoomFacts(room, {
    includeEquipment: asksAboutEquipment(options.normalized || '')
  });
  const atmosphere = extractAtmosphereFromDescription(description);
  const scenarioBlock = selectRelevantScenarioText(scenarios, {
    folder,
    guestProfile: options.guestProfile,
    normalized: options.normalized || ''
  });

  return joinSections([
    `КОМНАТА: ${folder}`,
    facts,
    atmosphere ? `АТМОСФЕРА И ОСОБЕННОСТИ:\n${atmosphere}` : '',
    scenarioBlock
      ? `СЦЕНАРИИ РАЗМЕЩЕНИЯ (используй блок «Как описывать» как основу ответа гостю):\n${scenarioBlock}`
      : ''
  ]);
}
