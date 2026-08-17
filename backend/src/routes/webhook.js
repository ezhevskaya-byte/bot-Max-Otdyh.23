import { verifyWebhook, processWebhook, maxPipelineLog } from '../../../integrations/max/webhook.js';
import { logger } from '../utils/logger.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export async function handleWebhookRequest(req, res) {
  maxPipelineLog('HTTP POST /webhook/max', {
    contentType: req.headers['content-type'],
    hasSecret: Boolean(
      req.headers['x-max-bot-api-secret']
        ?? req.headers['x-max-webhook-secret']
        ?? req.headers['x-webhook-secret'],
    ),
  });

  if (!verifyWebhook(req)) {
    maxPipelineLog('webhook unauthorized');
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch (err) {
    maxPipelineLog('invalid JSON body', { error: err.message });
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  logger.info('MAX webhook received', { updateType: body?.update_type });

  try {
    const result = await processWebhook(body);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result, null, 0));
  } catch (err) {
    maxPipelineLog('processWebhook unhandled error', { error: err.message });
    logger.error('processWebhook failed', { error: err.message, stack: err.stack });
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
