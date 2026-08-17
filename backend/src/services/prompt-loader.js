import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../prompts');

const cache = new Map();

export function loadPrompt(name) {
  if (cache.has(name)) return cache.get(name);
  const path = join(promptsDir, `${name}.md`);
  const content = readFileSync(path, 'utf-8');
  cache.set(name, content);
  return content;
}

export function buildSystemPrompt() {
  return [
    loadPrompt('system'),
    '---',
    loadPrompt('booking-collector'),
  ].join('\n\n');
}

export function buildRoomMatcherPrompt() {
  return loadPrompt('room-matcher');
}
