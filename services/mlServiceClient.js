/**
 * Typed client for the Python inference service (spec section 6.2).
 * Feature-flagged: a no-op unless ML_SERVICE_URL is configured, so wiring this
 * in changes NO behavior until we explicitly enable it.
 * Fail-safe: callers must treat a thrown error as "indeterminate, not pass".
 */
const cfg = require('../config/mlService');

function isEnabled() {
  return !!cfg.baseUrl();
}

async function _post(path, body) {
  if (!isEnabled()) {
    throw new Error('ML service not configured (ML_SERVICE_URL unset)');
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.timeoutMs());
  try {
    const res = await fetch(cfg.baseUrl() + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.serviceToken() ? { 'X-Service-Token': cfg.serviceToken() } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ML service ${path} returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function embed(keystrokes, modelVersion) {
  return _post('/embed', { keystrokes, modelVersion });
}

async function embedBatch(windows, modelVersion) {
  return _post('/embed_batch', { windows, modelVersion });
}

async function verify(embedding, profile, modelVersion) {
  return _post('/verify', { embedding, profile, modelVersion });
}

module.exports = { isEnabled, embed, embedBatch, verify };
