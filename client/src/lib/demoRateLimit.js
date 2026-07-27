const STORAGE_KEY = 'lawscribe_demo_generations';
const MAX_PER_WINDOW = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// TODO: This is a client-side, localStorage-based limiter for the public demo
// only. It is NOT a real rate limit — it's trivially bypassed by clearing
// localStorage, switching browsers, or using incognito mode. Before relying
// on this for cost control in production, add a server-side limiter to
// client/api/generate.js (e.g. IP-based, backed by Vercel KV / Upstash Redis)
// that rejects requests exceeding N per hour per IP regardless of client state.
export function checkDemoRateLimit() {
  const now = Date.now();
  let timestamps = [];

  try {
    timestamps = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    timestamps = [];
  }

  timestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_PER_WINDOW) {
    const minutesLeft = Math.ceil((timestamps[0] + WINDOW_MS - now) / 60000);
    return { allowed: false, minutesLeft };
  }

  timestamps.push(now);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
  return { allowed: true };
}
