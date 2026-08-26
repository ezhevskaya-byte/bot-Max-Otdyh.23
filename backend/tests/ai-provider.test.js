import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { complete, AiProviderError, resolveAiConfig } from '../src/core/ai/provider.js';

const SECRET = 'test-secret-key-do-not-log';

const ORIGINAL_ENV = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_API_BASE_URL: process.env.AI_API_BASE_URL,
  AI_MODEL: process.env.AI_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_API_BASE_URL: process.env.OPENROUTER_API_BASE_URL,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearProviderEnv() {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
  delete process.env.AI_API_BASE_URL;
  delete process.env.AI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_BASE_URL;
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_BASE_URL;
  delete process.env.OPENROUTER_MODEL;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

describe('AI provider', () => {
  let fetchCalls;
  let originalFetch;
  let originalConsole;
  let logs;

  beforeEach(() => {
    fetchCalls = [];
    logs = [];
    originalFetch = globalThis.fetch;
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    clearProviderEnv();
    process.env.AI_API_KEY = SECRET;
    process.env.AI_API_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_MODEL = 'openai/gpt-4o-mini';

    const capture = (...args) => {
      logs.push(args.map((arg) => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }).join(' '));
    };

    console.log = capture;
    console.error = capture;
    console.warn = capture;
    console.info = capture;
    console.debug = capture;

    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(200, {
        choices: [{ message: { content: '  Ответ модели  ' } }]
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    restoreEnv();
  });

  function lastCall() {
    assert.equal(fetchCalls.length, 1);
    return fetchCalls[0];
  }

  function parsedBody() {
    return JSON.parse(lastCall().options.body);
  }

  it('отправляет POST на /chat/completions', async () => {
    await complete({
      system: 'Ты консультант',
      messages: [{ role: 'user', content: 'Привет' }],
      temperature: 0.15
    });

    const call = lastCall();
    assert.equal(call.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(call.options.method, 'POST');
  });

  it('формирует Authorization header из env', async () => {
    await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    const headers = lastCall().options.headers;
    assert.equal(headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('передаёт model из env', async () => {
    await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    assert.equal(parsedBody().model, 'openai/gpt-4o-mini');
  });

  it('передаёт system и messages в тело запроса', async () => {
    await complete({
      system: 'Системный промпт',
      messages: [
        { role: 'user', content: 'Первый' },
        { role: 'assistant', content: 'Ответ' },
        { role: 'user', content: 'Второй' }
      ],
      temperature: 0.15
    });

    assert.deepEqual(parsedBody().messages, [
      { role: 'system', content: 'Системный промпт' },
      { role: 'user', content: 'Первый' },
      { role: 'assistant', content: 'Ответ' },
      { role: 'user', content: 'Второй' }
    ]);
    assert.equal(parsedBody().temperature, 0.15);
  });

  it('извлекает текст успешного ответа', async () => {
    const text = await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    assert.equal(text, 'Ответ модели');
  });

  it('AI_PROVIDER=openai использует OpenAI base URL/key/model', async () => {
    clearProviderEnv();
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = SECRET;
    process.env.OPENAI_API_BASE_URL = 'https://api.openai.com/v1';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';

    await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    const call = lastCall();
    assert.equal(call.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(call.options.headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(parsedBody().model, 'gpt-4o-mini');
    assert.equal(resolveAiConfig().provider, 'openai');
  });

  it('AI_PROVIDER=openrouter использует OpenRouter config', async () => {
    clearProviderEnv();
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = SECRET;
    process.env.OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';

    await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    const call = lastCall();
    assert.equal(call.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(call.options.headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(parsedBody().model, 'openai/gpt-4o-mini');
    assert.equal(resolveAiConfig().provider, 'openrouter');
  });

  it('контракт complete() для core остаётся прежним', async () => {
    const text = await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    assert.equal(typeof text, 'string');
    assert.equal(text.length > 0, true);
  });

  it('обрабатывает HTTP 401 как auth AiProviderError', async () => {
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(401, { error: { message: 'invalid key' } });
    };

    await assert.rejects(
      () => complete({
        system: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.15
      }),
      (err) => {
        assert.ok(err instanceof AiProviderError);
        assert.equal(err.status, 401);
        assert.equal(err.errorType, 'auth');
        assert.equal(err.provider, 'legacy');
        return true;
      }
    );
  });

  it('обрабатывает HTTP 403 как auth AiProviderError', async () => {
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(403, { error: { message: 'forbidden' } });
    };

    await assert.rejects(
      () => complete({
        system: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.15
      }),
      (err) => {
        assert.ok(err instanceof AiProviderError);
        assert.equal(err.status, 403);
        assert.equal(err.errorType, 'auth');
        assert.match(err.message, /HTTP 403/);
        return true;
      }
    );
  });

  it('обрабатывает HTTP 429 как rate_limit AiProviderError', async () => {
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(429, { error: { message: 'rate limit' } });
    };

    await assert.rejects(
      () => complete({
        system: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.15
      }),
      (err) => {
        assert.ok(err instanceof AiProviderError);
        assert.equal(err.status, 429);
        assert.equal(err.errorType, 'rate_limit');
        return true;
      }
    );
  });

  it('обрабатывает HTTP 500 как provider_error AiProviderError', async () => {
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(500, { error: { message: 'server' } });
    };

    await assert.rejects(
      () => complete({
        system: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.15
      }),
      (err) => {
        assert.ok(err instanceof AiProviderError);
        assert.equal(err.status, 500);
        assert.equal(err.errorType, 'provider_error');
        return true;
      }
    );
  });

  it('обрабатывает network error как AiProviderError', async () => {
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      throw new Error('fetch failed');
    };

    await assert.rejects(
      () => complete({
        system: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.15
      }),
      (err) => {
        assert.ok(err instanceof AiProviderError);
        assert.equal(err.errorType, 'network');
        assert.equal(err.status, 0);
        return true;
      }
    );
  });

  it('не логирует секретный ключ', async () => {
    await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(403, { error: { message: 'forbidden' } });
    };

    await assert.rejects(() => complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    }));

    const dump = logs.join('\n');
    assert.equal(dump.includes(SECRET), false);
    assert.equal(dump.includes('Bearer '), false);
  });

  it('логирует provider/status/errorType без секрета', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = SECRET;

    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return jsonResponse(403, { error: { message: 'forbidden' } });
    };

    await assert.rejects(() => complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    }));

    const dump = logs.join('\n');
    assert.match(dump, /"provider":"openai"/);
    assert.match(dump, /"status":403/);
    assert.match(dump, /"errorType":"auth"/);
    assert.match(dump, /AI provider request failed/);
    assert.equal(dump.includes(SECRET), false);
  });

  it('не знает про chatId и не отправляет его в API', async () => {
    await complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15
    });

    const raw = lastCall().options.body;
    assert.equal(raw.includes('chatId'), false);
    assert.equal(raw.includes('chat_id'), false);
  });
});
