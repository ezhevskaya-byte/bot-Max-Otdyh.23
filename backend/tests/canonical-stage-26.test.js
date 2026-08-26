import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT } from '../src/systemPrompt.js';
import { FAQ_INTENTS } from '../src/core/faq/answers.js';
import { matchCommand } from '../src/core/commands.js';
import { normalizeText } from '../src/core/text-normalize.js';
import { loadRoomLinks } from '../src/room-links.js';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = join(BACKEND, '..');

const ACTIVE_KNOWLEDGE_DIRS = [
  join(BACKEND, 'src', 'systemPrompt.js'),
  join(BACKEND, 'src', 'room-sales-logic.js'),
  join(BACKEND, 'src', 'core', 'faq', 'answers.js'),
  join(BACKEND, 'src', 'core', 'knowledge'),
  join(BACKEND, 'rooms'),
  join(BACKEND, 'property'),
  join(BACKEND, 'policies'),
  join(PROJECT, 'prompts', 'sales-rules.txt')
];

function collectFiles(path) {
  const stats = statSync(path);
  if (stats.isFile()) return [path];
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    const childStats = statSync(child);
    if (childStats.isDirectory()) return collectFiles(child);
    if (/\.(js|txt|json|md)$/i.test(name)) return [child];
    return [];
  });
}

function readActiveKnowledge() {
  return ACTIVE_KNOWLEDGE_DIRS.flatMap((path) =>
    collectFiles(path).map((file) => ({
      file,
      text: readFileSync(file, 'utf-8')
    }))
  );
}

describe('STAGE 2.6: активная база без устаревших противоречий', () => {
  const files = readActiveKnowledge();

  it('в активной базе нет старого сайта clients.site', () => {
    for (const { file, text } of files) {
      assert.equal(
        text.includes('otdyh-23.clients.site'),
        false,
        `устаревший сайт в ${file}`
      );
    }
  });

  it('канонический сайт присутствует в промпте и FAQ адреса', () => {
    assert.match(SYSTEM_PROMPT, /https:\/\/otdyh23\.ru\//);
    const address = FAQ_INTENTS.find((item) => item.id === 'address');
    assert.match(address.text, /https:\/\/otdyh23\.ru\//);
  });

  it('адрес содержит г. Сочи, п. Лазаревское, ул. Эвкалиптовая, 12', () => {
    assert.match(SYSTEM_PROMPT, /г\. Сочи, п\. Лазаревское, ул\. Эвкалиптовая, 12/);
  });

  it('нет ограничения «Семейная максимум 4» и вместимость до 5', () => {
    const familyRoom = JSON.parse(
      readFileSync(join(BACKEND, 'rooms', 'family_room', 'room.json'), 'utf-8')
    );
    assert.equal(familyRoom.capacity.max, 5);
    const scenarios = readFileSync(
      join(BACKEND, 'rooms', 'family_room', 'scenarios.txt'),
      'utf-8'
    );
    assert.doesNotMatch(scenarios, /НЕ предлагается для 5 взрослых/i);
    assert.doesNotMatch(scenarios, /максимум 4 гостя/i);
    assert.match(scenarios, /до 5 гостей/i);
  });

  it('нет устаревшего времени до моря 10–15 минут', () => {
    for (const { file, text } of files) {
      assert.doesNotMatch(
        text,
        /10–15 минут|10-15 минут/,
        `устаревшее время до моря в ${file}`
      );
    }
    assert.match(SYSTEM_PROMPT, /15–16 минут/);
  });

  it('бассейн: подогреваемый, 8,6 × 3,7, глубина 1,10–1,70, пользоваться до 21:00', () => {
    const pool = FAQ_INTENTS.find((item) => item.id === 'pool');
    assert.match(pool.text, /8,6/);
    assert.match(pool.text, /3,7/);
    assert.match(pool.text, /1,10/);
    assert.match(pool.text, /1,70/);
    assert.match(pool.text, /подогреваем/i);
    assert.match(pool.text, /Пользоваться бассейном можно с 09:00 до 21:00/);
    assert.doesNotMatch(pool.text, /бассейн работает/i);
    const houseRules = matchCommand(normalizeText('какие правила дома'));
    assert.equal(houseRules?.data?.intent, 'house_rules');
    assert.match(houseRules.text, /Пользоваться бассейном можно с 09:00 до 21:00/);
    assert.doesNotMatch(houseRules.text, /бассейн работает/i);
    for (const { file, text } of files) {
      if (!/commands\.js$|faq[/\\]answers\.js$/.test(file)) continue;
      assert.doesNotMatch(
        text,
        /бассейн работает/i,
        `клиентская формулировка «бассейн работает» в ${file}`
      );
    }
    for (const { file, text } of files) {
      assert.doesNotMatch(
        text,
        /бассейн не подогрев/i,
        `отрицание подогрева в ${file}`
      );
    }
  });

  it('кроватка: Комфорт можно, Делюкс 4 нельзя, Семейная можно', () => {
    const cot = FAQ_INTENTS.find((item) => item.id === 'baby_cot');
    assert.match(cot.text, /Комфорт/);
    assert.match(cot.text, /4 гостей детскую кроватку не устанавливаем/);
    assert.match(cot.text, /Семейной/);
  });

  it('Делюкс 2/3 различаются только балконом', () => {
    const diff = FAQ_INTENTS.find((item) => item.id === 'deluxe_difference');
    assert.match(diff.text, /небольшой французский балкон/);
    assert.match(diff.text, /большой балкон с уличной мебелью/);
    assert.match(diff.text, /идентичны/);
  });

  it('мангал ON_REQUEST_ONLY и не входит в стандартные FAQ территории', () => {
    const bbq = FAQ_INTENTS.find((item) => item.id === 'barbecue_area');
    assert.equal(bbq.knowledgeType, 'ON_REQUEST_ONLY');
    assert.match(SYSTEM_PROMPT, /ON_REQUEST_ONLY/);
    assert.match(SYSTEM_PROMPT, /Мангальная зона = ON_REQUEST_ONLY/);
  });

  it('есть check_in_out и barbecue_area', () => {
    const ids = FAQ_INTENTS.map((item) => item.id);
    assert.equal(ids.includes('check_in_out'), true);
    assert.equal(ids.includes('barbecue_area'), true);
    assert.equal(ids.includes('deluxe_large_balcony'), true);
    assert.equal(ids.includes('minibus'), true);
  });

  it('10 scenario URL на otdyh23.ru не изменились', () => {
    const links = loadRoomLinks();
    assert.equal(links.length, 10);
    for (const link of links) {
      assert.equal(link.url.includes('https://otdyh23.ru/'), true, link.scenario_id);
      assert.equal(link.url.includes('otdyh-23.clients.site'), false, link.scenario_id);
    }
  });
});
