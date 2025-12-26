const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_RESET_LOCK_KEY = 'daily_reset_lock';
const DAILY_RESET_LOCK_TTL = ONE_DAY_MS; // Lock for 24 hours

class Services {
  constructor(saasDbManager, pixPoller, cacheManager, logger) {
    this.saasDbManager = saasDbManager;
    this.pixPoller = pixPoller;
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.dailyInterval = null;
    this.hasDailyResetLock = false;
  }

  async startAll() {
    // Try to acquire a distributed lock for daily reset
    if (this.cacheManager.isRedisEnabled) {
      try {
        const acquired = await this.cacheManager.set(
          DAILY_RESET_LOCK_KEY,
          process.pid, // Value can be process ID or instance ID
          'EX',
          DAILY_RESET_LOCK_TTL / 1000, // TTL in seconds
          'NX' // Only set if key does not already exist
        );

        if (acquired) {
          this.hasDailyResetLock = true;
          this.logger.info('Acquired distributed lock for daily reset. Starting daily interval.');
        } else {
          this.logger.info('Could not acquire distributed lock for daily reset. Another instance is running it.');
        }
      } catch (err) {
        this.logger.error({ err }, 'Error acquiring daily reset lock');
      }
    }

    if (!this.dailyInterval && (!this.cacheManager.isRedisEnabled || this.hasDailyResetLock)) {
      this.dailyInterval = setInterval(async () => {
        try {
          if (!this.cacheManager.isRedisEnabled || this.hasDailyResetLock) {
            await this.saasDbManager.resetDailyUsage();
          } else {
            // Log if this instance tries to run but doesn't have the lock
            this.logger.warn('Attempted to run daily reset without holding the distributed lock.');
          }
        } catch (err) {
          this.logger.error({ err }, 'Failed running daily reset');
        }
      }, ONE_DAY_MS);
      // Run once at start
      try { await this.saasDbManager.resetDailyUsage(); } catch (e) {
        this.logger.error({ err: e }, 'Error running initial daily reset');
      }
    }

    // Start pix poller (pixPoller internally guards against duplicate starts)
    this.pixPoller.start();
  }

  async stopAll() {
    if (this.dailyInterval) {
      clearInterval(this.dailyInterval);
      this.dailyInterval = null;
    }

    // Release the distributed lock if held
    if (this.hasDailyResetLock && this.cacheManager.isRedisEnabled) {
      try {
        // Only delete the lock if this instance owns it
        const lockOwner = await this.cacheManager.get(DAILY_RESET_LOCK_KEY);
        if (lockOwner === String(process.pid)) { // Compare with String(process.pid) as Redis values are strings
          await this.cacheManager.invalidate(DAILY_RESET_LOCK_KEY);
          this.logger.info('Released distributed lock for daily reset.');
        }
      } catch (err) {
        this.logger.error({ err }, 'Error releasing daily reset lock');
      }
      this.hasDailyResetLock = false;
    }

    try { this.pixPoller.stop(); } catch (err) { this.logger.error({ err }, 'Error stopping pixPoller'); }

    // Note: other services can be stopped here
  }
}

module.exports = (saasDbManager, pixPoller, cacheManager, logger) => new Services(saasDbManager, pixPoller, cacheManager, logger);
