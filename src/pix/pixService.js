const pixGateway = require('./pixGateway');

const PIX_EXPIRATION_MINUTES = 30;
const MIN_AMOUNT = 1.00;
const MAX_UNPAID_PIX = 5;

const PLAN_MAP = {
    10: { planName: 'test', durationDays: 1 },
    30: { planName: 'weekly', durationDays: 7 },
    80: { planName: 'monthly', durationDays: 30 }
};

module.exports = (saasDbManager) => {
    const pixService = {
        async handleGeneratePixRequest(loggedInUsername, merchantUserId, amount) {
            if (isNaN(amount) || amount < MIN_AMOUNT) {
                throw { statusCode: 400, message: `Amount must be a number and at least ${MIN_AMOUNT}.` };
            }

            const user = await saasDbManager.findUserByUsername(loggedInUsername);
            if (!user) {
                throw { statusCode: 404, message: 'User not found.' };
            }
            if (user.suspended) {
                throw { statusCode: 403, message: 'Conta suspensa por múltiplos PIX não pagos. Entre em contato com o suporte.' };
            }

            const pixData = await pixGateway.generatePix(amount);

            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + PIX_EXPIRATION_MINUTES);

            await saasDbManager.createPixTransaction(loggedInUsername, {
                transactionId: pixData.transactionId,
                clientIdentifier: pixData.clientIdentifier,
                amount: amount,
                expires_at: expiresAt.toISOString(),
                qrcode: pixData.pix.qrcode,
                copypaste: pixData.pix.copypaste
            });

            return {
                ...pixData,
                warning: `Este PIX expira em ${PIX_EXPIRATION_MINUTES} minutos. Após esse prazo, o pagamento não será aceito.`
            };
        },

        async handleConsultPixRequest(clientIdentifier) {
            const pixInfo = await pixGateway.consultPix(clientIdentifier);
            
            const localPix = await saasDbManager.findPixByClientIdentifier(clientIdentifier);
            if (localPix && localPix.status !== pixInfo.status) {
                 await saasDbManager.updatePixStatus(clientIdentifier, pixInfo.status);
            }

            return pixInfo;
        },

        async processPendingTransactions() {
            console.log('[PixPoller] Starting check for pending and expired transactions...');

            const pendingTxs = await saasDbManager.getPendingPixTransactions();
            if (pendingTxs.length > 0) {
                console.log(`[PixPoller] Found ${pendingTxs.length} pending transaction(s) to check.`);
            }

            for (const tx of pendingTxs) {
                try {
                    const gatewayStatus = await pixGateway.consultPix(tx.clientIdentifier);
                    
                    if (gatewayStatus.status === 'COMPLETED' && tx.status !== 'COMPLETED') {
                        console.log(`[PixPoller] Transaction ${tx.clientIdentifier} is COMPLETED.`);
                        await saasDbManager.updatePixStatus(tx.clientIdentifier, 'COMPLETED');
                        await this.activatePlanForUser(tx.user_id, tx.amount);
                        
                        await saasDbManager.resetUserUnpaidCount(tx.user_id);
                        await saasDbManager.updateUserSuspension(tx.user_id, false);

                    } else if (gatewayStatus.status === 'FAILED' && tx.status !== 'FAILED') {
                        console.log(`[PixPoller] Transaction ${tx.clientIdentifier} has FAILED.`);
                        await saasDbManager.updatePixStatus(tx.clientIdentifier, 'FAILED');
                    }

                } catch (error) {
                    console.error(`[PixPoller] Failed to process transaction ${tx.clientIdentifier}:`, error.message);
                }
            }

            const expiredTxs = await saasDbManager.getExpiredPendingPixTransactions();
            if (expiredTxs.length > 0) {
                console.log(`[PixPoller] Found ${expiredTxs.length} newly expired transaction(s).`);
            }
            
            for (const tx of expiredTxs) {
                 console.log(`[PixPoller] Transaction ${tx.clientIdentifier} has EXPIRED.`);
                 await saasDbManager.updatePixStatus(tx.clientIdentifier, 'EXPIRED');

                 await saasDbManager.incrementUserUnpaidCount(tx.user_id);
                 const user = await saasDbManager.findUserById(tx.user_id);
                 if (user && user.unpaid_pix_count >= MAX_UNPAID_PIX) {
                     await saasDbManager.updateUserSuspension(tx.user_id, true);
                     console.warn(`[PixPoller] User ${user.username} (ID: ${tx.user_id}) has been suspended due to excessive unpaid PIX.`);
                 }
            }
        },

        async activatePlanForUser(userId, amount) {
            const planDetails = PLAN_MAP[amount];
            if (!planDetails) {
                console.warn(`[PixService] No plan mapped for amount: ${amount}. No action taken.`);
                return;
            }

            const user = await saasDbManager.findUserById(userId);
            if (!user) {
                console.error(`[PixService] Cannot activate plan. User with ID ${userId} not found.`);
                return;
            }

            console.log(`[PixService] Activating plan '${planDetails.planName}' for user ${user.username}.`);
            await saasDbManager.createOrRenewApiKey(userId, planDetails.planName, planDetails.durationDays);
        }
    };
    return pixService;
};
