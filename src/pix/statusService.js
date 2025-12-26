const pixGateway = require('./pixGateway'); // Reuse pixGateway for PIX check

module.exports = (saasDbManager, pixGateway) => {
    class StatusService {
        constructor() {
            this.lastStatus = {
                api: 'UNKNOWN',
                database: 'UNKNOWN',
                pixGateway: 'UNKNOWN',
                lastChecked: null,
                details: {}
            };
        }

        async checkAll() {
            const currentStatus = {
                api: 'UNKNOWN',
                database: 'UNKNOWN',
                pixGateway: 'UNKNOWN',
                lastChecked: new Date().toISOString(),
                details: {}
            };

            // Check API (always considered UP if the server is responding to this endpoint)
            currentStatus.api = 'Online';
            currentStatus.details.api = 'The API server is running and responsive.';

            // Check Database
            try {
                await saasDbManager.findUserById(1); // Simple query to check DB connection
                currentStatus.database = 'OK';
                currentStatus.details.database = 'SaaS database connection is active.';
            } catch (error) {
                currentStatus.database = 'OFFLINE';
                currentStatus.details.database = `Failed to connect to SaaS database: ${error.message}`;
                console.error('Status check: Database OFFLINE', error);
            }

            // Check PIX Gateway
            try {
                // Attempt to hit a harmless endpoint or a minimal transaction
                // Here, we'll try to generate a PIX with a minimal amount and check if it throws an error.
                // A more robust check might be a dedicated health check endpoint on the gateway.
                const testAmount = 1; // Smallest valid amount
                const dummyPix = await pixGateway.generatePix(testAmount);
                if (dummyPix && dummyPix.clientIdentifier) {
                     // For a real check, we'd delete this dummy pix.
                     // For now, we assume if it generates without error, the gateway is up.
                    currentStatus.pixGateway = 'OK';
                    currentStatus.details.pixGateway = 'PIX Gateway responded successfully to a test request.';
                } else {
                    currentStatus.pixGateway = 'UNKNOWN'; // Could be an unexpected response
                    currentStatus.details.pixGateway = 'PIX Gateway responded, but with unexpected data.';
                }
            } catch (error) {
                currentStatus.pixGateway = 'UNSTABLE';
                currentStatus.details.pixGateway = `PIX Gateway communication failed: ${error.message}`;
                console.error('Status check: PIX Gateway UNSTABLE', error);
            }

            this.lastStatus = currentStatus;
            return currentStatus;
        }

        getLastStatus() {
            // Return last checked status, re-check if too old (e.g., > 1 min)
            const now = new Date();
            const lastCheckedDate = this.lastStatus.lastChecked ? new Date(this.lastStatus.lastChecked) : null;

            if (!lastCheckedDate || (now.getTime() - lastCheckedDate.getTime() > 60 * 1000)) {
                // If status is old or never checked, trigger a new check in the background
                this.checkAll().catch(err => console.error('Background status check failed:', err));
            }
            return this.lastStatus;
        }
    }
    return new StatusService();
}