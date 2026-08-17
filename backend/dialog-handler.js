import { handleMessage } from './src/services/dialog-handler.js';

export function processMessage(userId, text, guestName, payload) {
  return handleMessage({ userId, text, guestName, payload });
}
