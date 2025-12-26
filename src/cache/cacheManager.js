const { LRUCache } = require('lru-cache');
const Redis = require('ioredis'); // Import ioredis
const config = require('../config');

class CacheManager {
  constructor(logger) {
    this.logger = logger;
    this.isRedisEnabled = !!config.cache.redisUrl;
    this.redisClient = null;

    if (this.isRedisEnabled) {
      this.redisClient = new Redis(config.cache.redisUrl);
      this.redisClient.on('error', (err) => this.logger.error({ err }, 'Redis Client Error'));
      this.redisClient.on('connect', () => this.logger.info('Redis Client Connected'));
      this.redisClient.on('ready', () => this.logger.info('Redis Client Ready'));
      this.redisClient.on('end', () => this.logger.info('Redis Client Disconnected'));
      this.logger.info('Cache Redis ativado. Turbo ligado.');
    } else {
      // Cache em memória usando LRU (Least Recently Used)
      this.memoryCache = new LRUCache({
        max: 1000, // Máximo de 1000 chaves na memória
        ttl: config.cache.ttl * 1000, // TTL em ms (config vem em segundos)
        updateAgeOnGet: true, // Reset do tempo de vida ao acessar
      });
      this.logger.info('Cache LRU em memória iniciado. Turbo ligado.');
    }
  }

  async connect() {
    if (this.isRedisEnabled && this.redisClient) {
      // ioredis connects automatically, but we can wait for it to be ready
      await new Promise((resolve, reject) => {
        this.redisClient.on('ready', resolve);
        this.redisClient.on('error', reject);
      });
      this.logger.info('Redis cache connected.');
    } else {
      this.logger.info('In-memory cache active.');
    }
  }

  /**
   * Verifica se o cache está ativo. Para Redis, verifica a conexão. Para LRU, sempre true.
   * @returns {boolean}
   */
  isConnected() {
    if (this.isRedisEnabled) {
      return this.redisClient && this.redisClient.status === 'ready';
    }
    return true; // In-memory cache is always "connected" if instantiated
  }

  async get(key) {
    if (this.isRedisEnabled && this.redisClient) {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }
    return this.memoryCache.get(key) || null;
  }

  async set(key, value) {
    if (this.isRedisEnabled && this.redisClient) {
      // Set with expiration (ttl from config)
      await this.redisClient.setex(key, config.cache.ttl, JSON.stringify(value));
    } else {
      this.memoryCache.set(key, value);
    }
  }

  async invalidate(key) {
    if (this.isRedisEnabled && this.redisClient) {
      await this.redisClient.del(key);
    } else {
      this.memoryCache.delete(key);
    }
  }

  async clear() {
    if (this.isRedisEnabled && this.redisClient) {
      await this.redisClient.flushdb();
    } else {
      this.memoryCache.clear();
    }
  }

  async disconnect() {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        await this.redisClient.quit();
        this.logger.info('Redis client disconnected.');
      } catch (err) {
        this.logger.error({ err }, 'Error disconnecting Redis client:', err.message);
      }
    } else if (this.memoryCache) {
      this.memoryCache.clear();
      this.logger.info('In-memory cache disconnected.');
    }
  }

  getStats() {
    if (this.isRedisEnabled && this.redisClient) {
      return {
        type: 'Redis',
        status: this.redisClient.status,
        host: this.redisClient.options.host,
        port: this.redisClient.options.port,
      };
    } else if (this.memoryCache) {
      return {
        type: 'LRU',
        size: this.memoryCache.size,
        max: this.memoryCache.max,
        ttl: this.memoryCache.ttl,
      };
    }
    return { type: 'None', status: 'inactive' };
  }
}

// Export a factory function
module.exports = (logger) => new CacheManager(logger);
