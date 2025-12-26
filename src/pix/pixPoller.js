const PIX_POLLER_LOCK_KEY = 'pix_poller_lock';
const POLLING_INTERVAL_SECONDS = 60;
const PIX_POLLER_LOCK_TTL = POLLING_INTERVAL_SECONDS * 2; // Lock for twice the polling interval

class PixPoller {
    constructor(pixService, cacheManager, logger) {
        this.pixService = pixService;
        this.cacheManager = cacheManager;
        this.logger = logger;
        this.intervalId = null;
        this.running = false;
        this.hasDistributedLock = false;
    }

    async start() {
        if (this.running) {
            this.logger.info('[PixPoller] Poller already running.');
            return;
        }

        if (this.cacheManager.isRedisEnabled) {
            try {
                // Attempt to acquire a distributed lock
                const acquired = await this.cacheManager.set(
                    PIX_POLLER_LOCK_KEY,
                    process.pid, // Value can be process ID
                    'EX',
                    PIX_POLLER_LOCK_TTL, // TTL in seconds
                    'NX' // Only set if key does not already exist
                );

                if (acquired) {
                    this.hasDistributedLock = true;
                    this.logger.info(`[PixPoller] Acquired distributed lock (${PIX_POLLER_LOCK_KEY}). Starting polling.`);
                } else {
                    this.logger.info(`[PixPoller] Another instance holds the lock (${PIX_POLLER_LOCK_KEY}). Poller will not start.`);
                    return; // Do not start poller if lock not acquired
                }
            } catch (err) {
                this.logger.error({ err }, '[PixPoller] Error acquiring distributed lock.');
                return; // Do not start poller if there was an error acquiring lock
            }
        } else {
            // Fallback for in-memory cache (single instance expected or no distributed lock desired)
            this.logger.warn('[PixPoller] Redis not enabled. Running without distributed lock. Ensure single instance deployment for safety.');
            this.hasDistributedLock = true; // Assume lock for single instance
        }

        this.running = true;
        this.logger.info('[PixPoller] Starting PIX polling service...');

        // Run once immediately on start, then set the interval
        await this.runProcessPendingTransactions();

        this.intervalId = setInterval(async () => {
            await this.runProcessPendingTransactions();
        }, POLLING_INTERVAL_SECONDS * 1000);

        this.logger.info(`[PixPoller] Service started. Checking every ${POLLING_INTERVAL_SECONDS} seconds.`);
    }

    async runProcessPendingTransactions() {
        try {
            // Re-check lock ownership before processing if Redis is enabled
            if (this.cacheManager.isRedisEnabled && !this.hasDistributedLock) {
                 this.logger.warn('[PixPoller] Instance unexpectedly lost distributed lock. Stopping poller.');
                 await this.stop();
                 return;
            }
            await this.pixService.processPendingTransactions();
        } catch (err) {
            this.logger.error({ err }, '[PixPoller] Error processing pending transactions.');
        }
    }

    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Release the distributed lock if this instance holds it
        if (this.hasDistributedLock && this.cacheManager.isRedisEnabled) {
            try {
                // Only delete the lock if this instance owns it
                const lockOwner = await this.cacheManager.get(PIX_POLLER_LOCK_KEY);
                if (lockOwner === String(process.pid)) {
                    await this.cacheManager.invalidate(PIX_POLLER_LOCK_KEY);
                    this.logger.info('[PixPoller] Released distributed lock.');
                }
            } catch (err) {
                this.logger.error({ err }, '[PixPoller] Error releasing distributed lock.');
            }
            this.hasDistributedLock = false;
        }

        this.running = false;
        this.logger.info('[PixPoller] Polling service stopped.');
    }
}

module.exports = (pixService, cacheManager, logger) => new PixPoller(pixService, cacheManager, logger);
