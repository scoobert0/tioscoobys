const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, '../../saas.db');
const db = new Database(dbPath);

class SaasDatabaseManager {
    constructor() {
        this.logger = console;
        this.initSaasTables();
    }

    setLogger(logger) {
        this.logger = logger;
    }

    initSaasTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                plan TEXT NOT NULL DEFAULT 'free',
                suspended BOOLEAN NOT NULL DEFAULT 0,
                unpaid_pix_count INTEGER NOT NULL DEFAULT 0,
                first_request_made BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                api_key TEXT UNIQUE NOT NULL,
                plan TEXT NOT NULL DEFAULT 'test',
                expires_at DATETIME NOT NULL,
                active BOOLEAN NOT NULL DEFAULT 1,
                requests_today INTEGER NOT NULL DEFAULT 0,
                requests_month INTEGER NOT NULL DEFAULT 0,
                last_used_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS pix_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                transactionId TEXT UNIQUE,
                clientIdentifier TEXT UNIQUE NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                expires_at DATETIME NOT NULL,
                qr_code_data TEXT,
                copy_paste_code TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                event_type TEXT NOT NULL,
                details TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        try { db.prepare('SELECT plan FROM users LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT \'free\''); }
        try { db.prepare('SELECT suspended FROM users LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE users ADD COLUMN suspended BOOLEAN NOT NULL DEFAULT 0'); }
        try { db.prepare('SELECT unpaid_pix_count FROM users LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE users ADD COLUMN unpaid_pix_count INTEGER NOT NULL DEFAULT 0'); }
        try { db.prepare('SELECT first_request_made FROM users LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE users ADD COLUMN first_request_made BOOLEAN NOT NULL DEFAULT 0'); }
        try { db.prepare('SELECT requests_month FROM api_keys LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE api_keys ADD COLUMN requests_month INTEGER NOT NULL DEFAULT 0'); }
        try { db.prepare('SELECT qr_code_data FROM pix_transactions LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE pix_transactions ADD COLUMN qr_code_data TEXT'); }
        try { db.prepare('SELECT copy_paste_code FROM pix_transactions LIMIT 1').get(); } catch (e) { db.exec('ALTER TABLE pix_transactions ADD COLUMN copy_paste_code TEXT'); }
    }

    // =========================
    // USERS
    // =========================
    getAllUsers() {
        const stmt = db.prepare('SELECT id, username, role, plan, suspended, unpaid_pix_count, created_at FROM users');
        return stmt.all();
    }
    findUserById(userId) {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(userId);
    }

    findUserByUsername(username) {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    }

    createUser(username, passwordHash, role = 'user', plan = 'free') {
        const stmt = db.prepare('INSERT INTO users (username, password_hash, role, plan) VALUES (?, ?, ?, ?)');
        const info = stmt.run(username, passwordHash, role, plan);
        return info.lastInsertRowid;
    }

    updateUserPasswordByUsername(username, newPasswordHash) {
        const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
        return stmt.run(newPasswordHash, username);
    }

    updateUserPlan(username, plan) {
        const user = this.findUserByUsername(username);
        if (!user) return;
        const stmt = db.prepare('UPDATE users SET plan = ? WHERE id = ?');
        return stmt.run(plan, user.id);
    }

    resetUserUnpaidCount(userId) {
        const stmt = db.prepare('UPDATE users SET unpaid_pix_count = 0 WHERE id = ?');
        return stmt.run(userId);
    }

    updateUserSuspension(userId, suspended) {
        const stmt = db.prepare('UPDATE users SET suspended = ? WHERE id = ?');
        return stmt.run(suspended ? 1 : 0, userId);
    }

    incrementUserUnpaidCount(userId) {
        const stmt = db.prepare('UPDATE users SET unpaid_pix_count = unpaid_pix_count + 1 WHERE id = ?');
        return stmt.run(userId);
    }
    
    updateUserFirstRequestMade(username) {
        const stmt = db.prepare('UPDATE users SET first_request_made = 1 WHERE username = ? AND first_request_made = 0');
        return stmt.run(username);
    }

    // =========================
    // API KEYS
    // =========================
    getUserKeys(username) {
        const user = this.findUserByUsername(username);
        if (!user) return [];
        const stmt = db.prepare('SELECT * FROM api_keys WHERE user_id = ?');
        return stmt.all(user.id);
    }

    getAllApiKeysWithUsernames() {
        const stmt = db.prepare('SELECT ak.*, u.username FROM api_keys ak JOIN users u ON ak.user_id = u.id ORDER BY u.username, ak.expires_at DESC');
        return stmt.all();
    }

    findKeyById(keyId) {
        const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
        return stmt.get(keyId);
    }

    updateApiKeyStatus(keyId, status) {
        const stmt = db.prepare('UPDATE api_keys SET active = ? WHERE id = ?');
        return stmt.run(status ? 1 : 0, keyId);
    }

    createApiKey(username, plan = 'test', durationDays = 30) {
        const user = this.findUserByUsername(username);
        if (!user) return null;

        const newKey = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        const stmt = db.prepare('INSERT INTO api_keys (user_id, api_key, plan, expires_at) VALUES (?, ?, ?, ?)');
        const info = stmt.run(user.id, newKey, plan, expiresAt.toISOString());

        this.logActivity(username, 'API_KEY_CREATED', `Created API key for plan ${plan}`);
        return { id: info.lastInsertRowid, api_key: newKey, plan, expires_at: expiresAt.toISOString() };
    }
    
    createOrRenewApiKey(userId, planName, durationDays) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
    
        const existingKey = db.prepare('SELECT * FROM api_keys WHERE user_id = ? AND plan = ?').get(userId, planName);
    
        if (existingKey) {
            const stmt = db.prepare('UPDATE api_keys SET expires_at = ?, active = 1 WHERE id = ?');
            stmt.run(expiresAt.toISOString(), existingKey.id);
        } else {
            const newKey = uuidv4();
            const stmt = db.prepare('INSERT INTO api_keys (user_id, api_key, plan, expires_at) VALUES (?, ?, ?, ?)');
            stmt.run(userId, newKey, planName, expiresAt.toISOString());
        }
    }

    deleteApiKey(keyId, username) {
        const user = this.findUserByUsername(username);
        if (!user) return false;

        const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
        const info = stmt.run(keyId, user.id);
        if (info.changes > 0) {
            this.logActivity(username, 'API_KEY_DELETED', `Deleted API key with ID: ${keyId}`);
        }
        return info.changes > 0;
    }

    regenerateApiKey(keyId, username) {
        const user = this.findUserByUsername(username);
        if (!user) return null;

        const newKey = uuidv4();
        const stmt = db.prepare('UPDATE api_keys SET api_key = ?, requests_today = 0, requests_month = 0, last_used_at = NULL WHERE id = ? AND user_id = ?');
        const info = stmt.run(newKey, keyId, user.id);

        if (info.changes > 0) {
            this.logActivity(username, 'API_KEY_REGENERATED', `Regenerated API key with ID: ${keyId}`);
        }
        return info.changes > 0 ? newKey : null;
    }

    findKeyByValue(apiKey) {
        const stmt = db.prepare('SELECT ak.*, u.username, u.plan as user_plan_type FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE api_key = ?');
        return stmt.get(apiKey);
    }

    incrementKeyUsage(keyId) {
        const stmt = db.prepare('UPDATE api_keys SET requests_today = requests_today + 1, requests_month = requests_month + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(keyId);
    }

    resetKeyUsage(apiKeyId) {
        const stmt = db.prepare('UPDATE api_keys SET requests_today = 0 WHERE id = ?');
        return stmt.run(apiKeyId);
    }
    
    resetDailyUsage() {
        const stmt = db.prepare('UPDATE api_keys SET requests_today = 0');
        return stmt.run();
    }
    
    resetMonthlyUsage() {
        const stmt = db.prepare('UPDATE api_keys SET requests_month = 0');
        return stmt.run();
    }

    // =========================
    // PIX TRANSACTIONS
    // =========================
    createPixTransaction(username, data) {
        const user = this.findUserByUsername(username);
        if (!user) return null;
    
        const { transactionId, clientIdentifier, amount, expires_at, qrcode, copypaste } = data;
    
        const stmt = db.prepare('INSERT INTO pix_transactions (user_id, transactionId, clientIdentifier, amount, expires_at, qr_code_data, copy_paste_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(user.id, transactionId, clientIdentifier, amount, expires_at, qrcode, copypaste);
        this.logActivity(username, 'PIX_GENERATED', `Generated PIX for amount ${amount}`);
        return info.lastInsertRowid;
    }

    getUserPixTransactions(username) {
        const user = this.findUserByUsername(username);
        if (!user) return [];
        const stmt = db.prepare('SELECT * FROM pix_transactions WHERE user_id = ? ORDER BY created_at DESC');
        return stmt.all(user.id);
    }

    updatePixStatus(clientIdentifier, status) {
        const stmt = db.prepare('UPDATE pix_transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE clientIdentifier = ?');
        return stmt.run(status, clientIdentifier);
    }
    
    getPendingPixTransactions() {
        const stmt = db.prepare("SELECT * FROM pix_transactions WHERE status = 'PENDING' AND expires_at > CURRENT_TIMESTAMP");
        return stmt.all();
    }

    getExpiredPendingPixTransactions() {
        const stmt = db.prepare("SELECT * FROM pix_transactions WHERE status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP");
        return stmt.all();
    }
    
    findPixByClientIdentifier(clientIdentifier) {
        const stmt = db.prepare('SELECT * FROM pix_transactions WHERE clientIdentifier = ?');
        return stmt.get(clientIdentifier);
    }

    getPlanInfoForUser(username) {
        const user = this.findUserByUsername(username);
        if (!user) return null;

        const keys = this.getUserKeys(username);
        const activeKey = keys.find(key => key.active && new Date(key.expires_at) > new Date());
        
        let planName = user.plan || 'free';
        let planLimit = 0;
        let planUsed = 0;
        let expiresAt = null;

        if (activeKey) {
            planName = activeKey.plan;
            planUsed = activeKey.requests_month;
            expiresAt = activeKey.expires_at;

            switch (planName) {
                case 'test': planLimit = 1; break;
                case 'weekly': planLimit = 1000; break;
                case 'monthly': planLimit = 10000; break;
                case 'pro': planLimit = 50000; break;
                default: planLimit = 0;
            }
        } else {
            planLimit = 50;
            planUsed = 0; 
        }

        return {
            name: planName.toUpperCase(),
            limit: planLimit,
            used: planUsed,
            expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'N/A'
        };
    }

    // =========================
    // DASHBOARD STATS
    // =========================
    getDashboardStats(username) {
        const user = this.findUserByUsername(username);
        if (!user) {
            return { requestsToday: 0, requestsMonth: 0, errors: 0, pixPaid: 0, pixPending: 0, pixExpired: 0 };
        }

        const totalRequestsToday = db.prepare('SELECT SUM(requests_today) FROM api_keys WHERE user_id = ?').get(user.id)['SUM(requests_today)'] || 0;
        const totalRequestsMonth = db.prepare('SELECT SUM(requests_month) FROM api_keys WHERE user_id = ?').get(user.id)['SUM(requests_month)'] || 0;
        
        const pixPaid = db.prepare('SELECT COUNT(*) FROM pix_transactions WHERE user_id = ? AND status = \'COMPLETED\'').get(user.id)['COUNT(*)'] || 0;
        const pixPending = db.prepare('SELECT COUNT(*) FROM pix_transactions WHERE user_id = ? AND status = \'PENDING\'').get(user.id)['COUNT(*)'] || 0;
        const pixExpired = db.prepare('SELECT COUNT(*) FROM pix_transactions WHERE user_id = ? AND status = \'EXPIRED\'').get(user.id)['COUNT(*)'] || 0;

        const errors = 0; 

        return {
            requestsToday: totalRequestsToday,
            requestsMonth: totalRequestsMonth,
            errors: errors,
            pixPaid: pixPaid,
            pixPending: pixPending,
            pixExpired: pixExpired
        };
    }

    // =========================
    // ACTIVITY LOGS
    // =========================
    logActivity(username, eventType, details) {
        const user = this.findUserByUsername(username);
        if (!user) return;
        const stmt = db.prepare('INSERT INTO activity_logs (user_id, event_type, details) VALUES (?, ?, ?)');
        return stmt.run(user.id, eventType, details);
    }
    
    logUsage(apiKeyId, endpoint, statusCode) {
        // This is a simplified version. A real implementation might want to log more details.
        const stmt = db.prepare('INSERT INTO activity_logs (user_id, event_type, details) SELECT user_id, ?, ? FROM api_keys WHERE id = ?');
        const details = `Endpoint: ${endpoint}, Status: ${statusCode}`;
        stmt.run('API_USAGE', details, apiKeyId);
    }

    getActivityLogs(username) {
        const user = this.findUserByUsername(username);
        if (!user) return [];
        const stmt = db.prepare('SELECT timestamp, event_type, details FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC');
        return stmt.all(user.id);
    }

    close() {
        if (db) {
            db.close();
            this.logger.info(`Database saas.db closed.`);
        }
    }
}

module.exports = new SaasDatabaseManager();