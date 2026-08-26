import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(filename) {
  const path = join(__dirname, filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export const app = {
  name: 'Отдых23',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export const max = {
  botToken: process.env.MAX_BOT_TOKEN || '',
  webhookSecret: process.env.MAX_WEBHOOK_SECRET || '',
  apiBaseUrl: process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru',
};

if (max.botToken && max.apiBaseUrl.includes('api.max.ru') && !max.apiBaseUrl.includes('platform-api')) {
  console.warn('[config] MAX_API_BASE_URL должен быть https://platform-api.max.ru');
}

import { resolveAiConfig } from '../backend/src/core/ai/config.js';

export const ai = {
  get provider() {
    return resolveAiConfig().provider;
  },
  get apiKey() {
    return resolveAiConfig().apiKey;
  },
  get apiBaseUrl() {
    return resolveAiConfig().apiBaseUrl;
  },
  get model() {
    return resolveAiConfig().model;
  }
};

export const admin = {
  maxUserId: process.env.ADMIN_MAX_USER_ID || '',
  name: process.env.ADMIN_NAME || 'Оксана',
};

export const bookingLite = {
  enabled: process.env.BOOKINGLITE_ENABLED === 'true',
  apiUrl: process.env.BOOKINGLITE_API_URL || '',
  apiKey: process.env.BOOKINGLITE_API_KEY || '',
};

export const rooms = loadJson('rooms.json');
export const bookingFlow = loadJson('booking-flow.json');
