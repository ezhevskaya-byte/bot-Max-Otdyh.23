import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), '../../../templates');

/**
 * Простая подстановка {{key}} и {{#if key}}...{{/if}}
 */
export function renderTemplate(filename, data = {}) {
  let text = readFileSync(join(templatesDir, filename), 'utf-8');

  text = text.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
    const value = data[key];
    return value && value !== '0' && value !== 0 ? block : '';
  });

  for (const [key, value] of Object.entries(data)) {
    text = text.replaceAll(`{{${key}}}`, String(value ?? ''));
  }

  return text.trim();
}

export function loadMessages() {
  const path = join(templatesDir, 'messages.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}
