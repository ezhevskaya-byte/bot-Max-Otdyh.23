import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_ROOT = join(__dirname, '..');
const ROOMS_ROOT = join(BACKEND_ROOT, 'rooms');
const PROPERTY_ROOT = join(BACKEND_ROOT, 'property');

const PORT = process.env.STATIC_PORT || 3001;

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function getMimeType(filePath) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith('.jpg')) return MIME_TYPES['.jpg'];
  if (lower.endsWith('.jpeg')) return MIME_TYPES['.jpeg'];
  if (lower.endsWith('.png')) return MIME_TYPES['.png'];
  if (lower.endsWith('.webp')) return MIME_TYPES['.webp'];

  return 'application/octet-stream';
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const cleanPath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const fullPath = join(root, cleanPath);

  if (!fullPath.startsWith(root)) return null;

  return fullPath;
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    let filePath = null;

    if (url.pathname.startsWith('/rooms/')) {
      filePath = safeJoin(ROOMS_ROOT, url.pathname.replace('/rooms/', ''));
    }

    if (url.pathname.startsWith('/property/')) {
      filePath = safeJoin(PROPERTY_ROOT, url.pathname.replace('/property/', ''));
    }

    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'public, max-age=3600'
    });

    createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`Static photo server started on http://localhost:${PORT}`);
});