import crypto from 'crypto';

export const KEY_PREFIX = 'lsk_live_';

export function generateApiKey() {
  const random = crypto.randomBytes(24).toString('base64url');
  const fullKey = `${KEY_PREFIX}${random}`;
  return {
    fullKey,
    prefix: fullKey.slice(0, 12),
    hash: hashApiKey(fullKey)
  };
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}
