import { config } from '../config/env.js';

export function getRedisConnectionOptions() {
  return {
    url: config.redis.url,
  };
}
