import { config } from '../config/env.js';

export function getRedisConnectionOptions() {
  const url = new URL(config.redis.url);
  const useTls = url.protocol === 'rediss:';

  return {
    host: url.hostname,
    port: Number(url.port) || (useTls ? 6380 : 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
  };
}
