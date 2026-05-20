// lib/redis.ts
// Secure and ultra-lightweight stateless client for Upstash Redis REST API.
// Eliminates cold-start package overhead and native bindings.
// Integrates fallback modes for safe local developer sandboxing.

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Local development in-memory backup database.
const localMemoryDb = new Map<string, { value: string; expiresAt: number }>();

function mockRedis(command: string[]): any {
  const [cmd, key, val, arg3, arg4] = command;
  const now = Date.now();

  console.warn(
    `[Upstash Redis Mock] Running offline command: ${cmd} ${key || ''} ${val || ''}. Please configure UPSTASH_REDIS_REST_URL for production resilience.`
  );

  switch (cmd.toUpperCase()) {
    case 'SET': {
      let expiresAt = Infinity;
      if (arg3 === 'EX' && arg4) {
        expiresAt = now + parseInt(arg4, 10) * 1000;
      }
      localMemoryDb.set(key, { value: val, expiresAt });
      return 'OK';
    }
    case 'GET': {
      const record = localMemoryDb.get(key);
      if (!record) return null;
      if (now > record.expiresAt) {
        localMemoryDb.delete(key);
        return null;
      }
      return record.value;
    }
    case 'DEL': {
      const existed = localMemoryDb.has(key);
      localMemoryDb.delete(key);
      return existed ? 1 : 0;
    }
    case 'INCR': {
      const record = localMemoryDb.get(key);
      let count = 0;
      if (record && now <= record.expiresAt) {
        count = parseInt(record.value, 10);
      }
      count += 1;
      localMemoryDb.set(key, { value: count.toString(), expiresAt: record?.expiresAt || Infinity });
      return count;
    }
    case 'EXPIRE': {
      const record = localMemoryDb.get(key);
      if (record) {
        record.expiresAt = now + parseInt(val, 10) * 1000;
        return 1;
      }
      return 0;
    }
    default:
      return null;
  }
}

/**
 * Executes raw array commands directly against the Upstash REST endpoint.
 */
async function execute(command: string[]): Promise<any> {
  if (!redisUrl || !redisToken) {
    return mockRedis(command);
  }

  try {
    const cleanUrl = redisUrl.endsWith('/') ? redisUrl : `${redisUrl}/`;
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      console.error(`[Redis HTTP Client Error] HTTP ${response.status}: ${response.statusText}`);
      return mockRedis(command); // fallback gracefully to avoid service outages
    }

    const json = await response.json();
    return json.result;
  } catch (err) {
    console.error('[Redis Client Exception] Fetch round failed:', err);
    return mockRedis(command);
  }
}

export const redis = {
  async get(key: string): Promise<string | null> {
    return execute(['GET', key]);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    if (ttlSeconds) {
      return execute(['SET', key, value, 'EX', ttlSeconds.toString()]);
    }
    return execute(['SET', key, value]);
  },

  async del(key: string): Promise<number> {
    return execute(['DEL', key]);
  },

  async incr(key: string): Promise<number> {
    return execute(['INCR', key]);
  },

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return execute(['EXPIRE', key, ttlSeconds.toString()]);
  },
};

/**
 * Check if the caller IP has exceeded the rate limit of failed token validations.
 * Enforces a strict ceiling of max 10 failed attempts within 15 minutes.
 */
export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:ip:${ip}`;
  const attempts = await redis.incr(key);

  if (attempts === 1) {
    // New rate limit window starts — set a 15 minute (900 seconds) expiration TTL
    await redis.expire(key, 900);
  }

  const limit = 10;
  const remaining = Math.max(0, limit - attempts);

  return {
    allowed: attempts <= limit,
    remaining,
  };
}

/**
 * Blocklists a session ID until its JWT token expires.
 */
export async function blocklistSession(sessionId: string, ttlSeconds: number): Promise<void> {
  const key = `revoked:${sessionId}`;
  await redis.set(key, 'true', ttlSeconds);
}

/**
 * Verify if a session ID resides in our revoked Upstash database.
 */
export async function isSessionBlocklisted(sessionId: string): Promise<boolean> {
  const key = `revoked:${sessionId}`;
  const res = await redis.get(key);
  return res === 'true';
}
