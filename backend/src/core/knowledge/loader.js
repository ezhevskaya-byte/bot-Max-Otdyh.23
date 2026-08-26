import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT } from '../../systemPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const BACKEND_ROOT = join(__dirname, '..', '..', '..');
export const PROJECT_ROOT = join(BACKEND_ROOT, '..');

export function readTextFileSafe(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

export const ROOM_FOLDER_MAP = {
  room_comfort: 'comfort_2floor',
  room_deluxe_2: 'deluxe_2floor',
  room_deluxe_3: 'deluxe_3floor',
  room_family: 'family_room'
};

export function loadRoomFolderKnowledge(folder) {
  const folderPath = join(BACKEND_ROOT, 'rooms', folder);
  if (!existsSync(folderPath)) return '';

  return `
КОМНАТА: ${folder}

ROOM.JSON:
${readTextFileSafe(join(folderPath, 'room.json'))}

DESCRIPTION:
${readTextFileSafe(join(folderPath, 'description.txt'))}

SCENARIOS:
${readTextFileSafe(join(folderPath, 'scenarios.txt'))}
`.trim();
}

function loadRoomsKnowledge() {
  const roomsRoot = join(BACKEND_ROOT, 'rooms');
  if (!existsSync(roomsRoot)) {
    return 'База комнат пока не подключена.';
  }

  const roomFolders = readdirSync(roomsRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  return roomFolders
    .map((folder) => loadRoomFolderKnowledge(folder))
    .filter(Boolean)
    .join('\n\n-----------------------------\n\n');
}

function loadPropertyFolder(folder) {
  const folderPath = join(BACKEND_ROOT, 'property', folder);
  if (!existsSync(folderPath)) return '';

  return `
ОБЪЕКТ: ${folder}

DESCRIPTION:
${readTextFileSafe(join(folderPath, 'description.txt'))}

SCENARIOS:
${readTextFileSafe(join(folderPath, 'scenarios.txt'))}
`;
}

function loadPropertyKnowledge() {
  const propertyRoot = join(BACKEND_ROOT, 'property');
  if (!existsSync(propertyRoot)) {
    return 'База территории пока не подключена.';
  }

  const folders = readdirSync(propertyRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  return folders
    .map((folder) => loadPropertyFolder(folder))
    .join('\n\n-----------------------------\n\n');
}

function loadPolicyFile(fileName) {
  return readTextFileSafe(join(BACKEND_ROOT, 'policies', fileName));
}

function loadPoliciesKnowledge() {
  const policiesRoot = join(BACKEND_ROOT, 'policies');
  if (!existsSync(policiesRoot)) {
    return 'База правил пока не подключена.';
  }

  return readdirSync(policiesRoot)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map(
      (file) => `
POLICY FILE: ${file}

${readTextFileSafe(join(policiesRoot, file))}
`
    )
    .join('\n\n-----------------------------\n\n');
}

function loadTextFilesFromFolder(folderPath, label) {
  if (!existsSync(folderPath)) return [];

  return readdirSync(folderPath)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map((file) => {
      const filePath = join(folderPath, file);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) return '';
      const content = readTextFileSafe(filePath);
      if (!content.trim()) return '';

      return `
${label}: ${file}
PATH: ${filePath}

${content}
`;
    })
    .filter(Boolean);
}

function loadPromptsKnowledge() {
  const parts = [
    ...loadTextFilesFromFolder(join(BACKEND_ROOT, 'prompts'), 'PROMPT FILE'),
    ...loadTextFilesFromFolder(join(PROJECT_ROOT, 'prompts'), 'PROMPT FILE')
  ];

  return parts.length
    ? parts.join('\n\n-----------------------------\n\n')
    : 'Дополнительные sales prompt пока не подключены.';
}

export const ROOM_FOLDER_KNOWLEDGE = Object.fromEntries(
  Object.entries(ROOM_FOLDER_MAP).map(([sectionId, folder]) => [
    sectionId,
    loadRoomFolderKnowledge(folder)
  ])
);

export const KNOWLEDGE_FILES = {
  rooms: loadRoomsKnowledge(),
  property: loadPropertyKnowledge(),
  policies: loadPoliciesKnowledge(),
  prompts: loadPromptsKnowledge(),
  generalRules: loadPolicyFile('general_rules.txt'),
  bookingRules: loadPolicyFile('booking_rules.txt'),
  communicationStyle: loadPolicyFile('communication_style.txt'),
  objections: loadPolicyFile('objections.txt'),
  salesRules: readTextFileSafe(join(PROJECT_ROOT, 'prompts', 'sales-rules.txt')),
  pool: loadPropertyFolder('pool'),
  terrace: loadPropertyFolder('terrace'),
  location: loadPropertyFolder('location')
};

export const LEGACY_EXTRA_RULES = `
ВАЖНО:
1. Используй базу комнат как главный источник информации о категориях, размещении, сценариях, ограничениях и описаниях.
2. Используй sales-rules как главный источник логики продаж и ведения гостя к бронированию.
3. Для состава 2 взрослых + 1 ребёнок сначала предлагай «Комфорт», а «Семейную» только как более просторную альтернативу.
4. Если гость прямо просит вариант поменьше, компактнее, дешевле или спрашивает почему не «Комфорт» — обязательно подробно расскажи про «Комфорт» и не настаивай на «Семейной».
5. Не придумывай цены и свободные даты.
6. Если нужно подтвердить наличие мест, стоимость или бронирование — переводи к администратору Оксане.
7. Не пиши гостю технические ограничения: «не могу отправить фото», «автоматическая отправка невозможна» и подобные фразы.
8. Помни контекст диалога: последнюю предложенную комнату, состав гостей, даты и пожелания.
`;

/**
 * Снимок старого AI-контекста STAGE 2 (до retrieval).
 * Нужен для аудита и сравнения экономии, не отправляется в live-контуре.
 */
export function buildLegacyFullSystemPrompt(roomSelectionHint = '') {
  return `${SYSTEM_PROMPT}

ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ПРОДАЖ И ПЕРЕГОВОРОВ:

${KNOWLEDGE_FILES.prompts}

БАЗА КОМНАТ ГОСТЕВОГО ДОМА:

${KNOWLEDGE_FILES.rooms}

БАЗА ТЕРРИТОРИИ И ОБЩИХ ЗОН:

${KNOWLEDGE_FILES.property}

ПРАВИЛА, ПОЛИТИКИ И СТИЛЬ ОБЩЕНИЯ:

${KNOWLEDGE_FILES.policies}

${LEGACY_EXTRA_RULES}

ДОПОЛНИТЕЛЬНАЯ ЖЁСТКАЯ ЛОГИКА ПОДБОРА:

${roomSelectionHint}
`;
}

export function getLegacyContextSizes() {
  return {
    systemPromptChars: SYSTEM_PROMPT.length,
    promptsChars: KNOWLEDGE_FILES.prompts.length,
    roomsChars: KNOWLEDGE_FILES.rooms.length,
    propertyChars: KNOWLEDGE_FILES.property.length,
    policiesChars: KNOWLEDGE_FILES.policies.length,
    extraRulesChars: LEGACY_EXTRA_RULES.length,
    totalBeforeHistory: buildLegacyFullSystemPrompt('').length
  };
}

export function sliceByHeading(text, heading, stopHeadings = []) {
  const source = String(text || '');
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().startsWith(heading));
  if (start === -1) return '';

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (stopHeadings.some((stop) => lines[i].trim().startsWith(stop))) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n').trim();
}

export function joinSections(parts) {
  return parts.filter((part) => String(part || '').trim()).join('\n\n');
}

export function stripBarbecueLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !/мангал|шашлык|барбекю|гриль/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
