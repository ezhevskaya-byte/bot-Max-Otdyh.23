import { bookingLite } from '../../../config/index.js';

export function handleHealth(_req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'ok',
      service: 'otdyh23-max-bot',
      bookingLite: bookingLite.enabled ? 'enabled' : 'disabled',
    }),
  );
}
