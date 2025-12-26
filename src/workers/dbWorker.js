const { parentPort } = require('worker_threads');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

/* =========================
   DB MANAGER (READ-ONLY DBS)
========================= */

const dbConnections = new Map();
const dbTableCache = new Map();

function connectAllDbs() {
  config.database.paths.forEach((dbPath) => {
    const fullPath = path.resolve(dbPath.trim());
    if (!fs.existsSync(fullPath)) {
      console.warn(`[Worker] Banco não encontrado: ${fullPath}`);
      return;
    }

    try {
      const db = new Database(fullPath, {
        readonly: true,
        fileMustExist: true,
      });

      const dbName = path.basename(fullPath);
      dbConnections.set(dbName, db);
      cacheTableNames(dbName, db);

      console.log(`[Worker] Conectado: ${dbName}`);
    } catch (err) {
      console.error(`[Worker] Erro ao conectar ${fullPath}:`, err.message);
    }
  });
}

function cacheTableNames(dbName, db) {
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all();

    dbTableCache.set(
      dbName,
      tables.map((t) => t.name)
    );
  } catch (err) {
    console.error(`[Worker] Erro cache tabelas ${dbName}:`, err.message);
  }
}

async function executeQueryAll(queryFnString, params) {
  const queryFn = new Function(
    'db',
    'tables',
    'params',
    `return (${queryFnString})(db, tables, params);`
  );

  const results = [];

  for (const [dbName, db] of dbConnections.entries()) {
    const tables = dbTableCache.get(dbName) || [];
    try {
      const dbResults = queryFn(db, tables, params);
      if (dbResults?.length) {
        results.push({ db: dbName, results: dbResults });
      }
    } catch (err) {
      console.error(`[Worker] Query falhou em ${dbName}:`, err.message);
    }
  }

  return results;
}

/* =========================
   SAAS DB
========================= */

let saasDbInstance = null;

const SAAS_DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  suspended INTEGER DEFAULT 0,
  unpaid_pix_count INTEGER DEFAULT 0,
  onboarding_step TEXT DEFAULT 'create_key',
  has_made_first_request INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  active INTEGER DEFAULT 1,
  requests_today INTEGER DEFAULT 0,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pix_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transactionId TEXT UNIQUE NOT NULL,
  clientIdentifier TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  expires_at DATETIME NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    details TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

function connectSaasDb() {
  const saasDbPath = path.join(__dirname, '..', '..', 'saas.db');
  const isNew = !fs.existsSync(saasDbPath);

  saasDbInstance = new Database(saasDbPath);
  saasDbInstance.pragma('journal_mode = WAL');

  if (isNew) {
    saasDbInstance.exec(SAAS_DB_SCHEMA);

    const adminPass = bcrypt.hashSync('adminpass', 10);
    saasDbInstance
      .prepare(
        `INSERT INTO users (username, password_hash, role, onboarding_step)
         VALUES (?, ?, 'admin', 'complete')`
      )
      .run('admin', adminPass);

    console.warn('[Worker] ADMIN criado (admin / adminpass). TROQUE ISSO.');
  }

  console.log('[Worker] SaaS DB pronto');
}

/* =========================
   INIT
========================= */

connectAllDbs();
connectSaasDb();

/* =========================
   WORKER MESSAGE HANDLER
========================= */

parentPort.on('message', async (message) => {
  const { taskId, taskType, args } = message;
  let result = null;
  let error = null;

  try {
    switch (taskType) {
      case 'dbManager.queryAll':
        result = await executeQueryAll(args.queryFnString, args.params);
        break;

      case 'saasDbManager.findUserById': {
        const user = saasDbInstance
          .prepare('SELECT * FROM users WHERE id = ?')
          .get(args[0]);

        if (user) {
          // This logic is now inside the worker to return a complete user object
          const keys = saasDbInstance.prepare('SELECT * FROM api_keys WHERE user_id = ?').all(user.id);
          const activeKey = keys.find(key => key.active && new Date(key.expires_at) > new Date());
          
          let planName = user.plan || 'free';
          let planLimit = 0;
          let planUsed = 0;
          let expiresAt = null;

          if (activeKey) {
              planName = activeKey.plan;
              planUsed = activeKey.requests_month || 0;
              expiresAt = activeKey.expires_at;

              switch (planName) {
                  case 'test': planLimit = 100; break;
                  case 'weekly': planLimit = 1000; break;
                  case 'monthly': planLimit = 10000; break;
                  case 'pro': planLimit = 50000; break;
                  default: planLimit = 0;
              }
          } else {
              planLimit = 50; 
              planUsed = 0; 
          }

          user.plan = {
              name: planName.toUpperCase(),
              limit: planLimit,
              used: planUsed,
              expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'N/A'
          };
        }

        result = user;
        break;
      }

      case 'saasDbManager.createUser': {
        const info = saasDbInstance
          .prepare(
            `INSERT INTO users (username, password_hash, role, onboarding_step)
             VALUES (?, ?, ?, 'create_key')`
          )
          .run(args[0], args[1], args[2]);

        result = { id: info.lastInsertRowid };
        break;
      }

      case 'saasDbManager.createOrRenewApiKey': {
        const key = `sk_${args[1].slice(0, 4)}_${uuidv4().replace(/-/g, '')}`;
        const expires = new Date();
        expires.setDate(expires.getDate() + args[2]);

        saasDbInstance
          .prepare(
            `INSERT INTO api_keys (user_id, api_key, plan, expires_at)
             VALUES (?, ?, ?, ?)`
          )
          .run(args[0], key, args[1], expires.toISOString());

        result = key;
        break;
      }

      case 'saasDbManager.incrementKeyUsage':
        saasDbInstance
          .prepare(
            `UPDATE api_keys
             SET requests_today = requests_today + 1,
                 last_used_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .run(args[0]);
        break;

      case 'saasDbManager.resetDailyUsage':
        saasDbInstance
          .prepare('UPDATE api_keys SET requests_today = 0')
          .run();
        break;

      case 'saasDbManager.resetKeyUsage':
        saasDbInstance
          .prepare('UPDATE api_keys SET requests_today = 0 WHERE id = ?')
          .run(args[0]);
        break;

      case 'saasDbManager.createPixTransaction':
        saasDbInstance
          .prepare(
            `INSERT INTO pix_transactions (transactionId, clientIdentifier, user_id, amount, expires_at)
             VALUES (:transactionId, :clientIdentifier, :user_id, :amount, :expires_at)`
          )
          .run(args);
        break;

      case 'saasDbManager.findPixByClientIdentifier':
        result = saasDbInstance
          .prepare('SELECT * FROM pix_transactions WHERE clientIdentifier = ?')
          .get(args[0]);
        break;

      case 'saasDbManager.updatePixStatus':
        saasDbInstance
          .prepare(
            `UPDATE pix_transactions SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE clientIdentifier = ?`
          )
          .run(args[1], args[0]);
        break;

      case 'saasDbManager.getPendingPixTransactions':
        result = saasDbInstance
          .prepare(
            `SELECT * FROM pix_transactions WHERE status = 'PENDING' AND expires_at > CURRENT_TIMESTAMP`
          )
          .all();
        break;

      case 'saasDbManager.getExpiredPendingPixTransactions':
        result = saasDbInstance
          .prepare(
            `SELECT * FROM pix_transactions WHERE status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP`
          )
          .all();
        break;

      case 'saasDbManager.incrementUserUnpaidCount':
        saasDbInstance
          .prepare('UPDATE users SET unpaid_pix_count = unpaid_pix_count + 1 WHERE id = ?')
          .run(args[0]);
        break;

      case 'saasDbManager.resetUserUnpaidCount':
        saasDbInstance
          .prepare('UPDATE users SET unpaid_pix_count = 0 WHERE id = ?')
          .run(args[0]);
        break;

      case 'saasDbManager.findUserByUsername':
        result = saasDbInstance
          .prepare('SELECT * FROM users WHERE username = ?')
          .get(args[0]);
        break;

      case 'saasDbManager.findKeyByValue':
        result = saasDbInstance
          .prepare('SELECT * FROM api_keys WHERE api_key = ?')
          .get(args[0]);
        break;

      case 'saasDbManager.logUsage':
        // This is a placeholder for a more complete logging solution.
        // In a real-world scenario, you would insert into a dedicated logs table.
        break;

      case 'saasDbManager.updateUserSuspension':
        saasDbInstance
          .prepare('UPDATE users SET suspended = ? WHERE id = ?')
          .run(args[1], args[0]);
        break;

      case 'saasDbManager.updateUserPassword': // New
        saasDbInstance
          .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .run(args[1], args[0]);
        break;

      case 'saasDbManager.deleteApiKey': // New
        result = saasDbInstance
          .prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
          .run(args[0], args[1]).changes > 0;
        break;

      case 'saasDbManager.logActivity': // New
        saasDbInstance
          .prepare('INSERT INTO activity_logs (user_id, event_type, details) VALUES (?, ?, ?)')
          .run(args.userId, args.eventType, args.details);
        break;

      case 'saasDbManager.createApiKey': { // New
        const newKey = `sk_${uuidv4().replace(/-/g, '')}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + args[2]); // durationDays

        const info = saasDbInstance.prepare('INSERT INTO api_keys (user_id, api_key, plan, expires_at) VALUES (?, ?, ?, ?)')
          .run(args[0], newKey, args[1], expiresAt.toISOString()); // userId, plan
        
        result = { id: info.lastInsertRowid, api_key: newKey, plan: args[1], expires_at: expiresAt.toISOString() };
        break;
      }

      case 'saasDbManager.getUserKeys':
        result = saasDbInstance
          .prepare('SELECT * FROM api_keys WHERE user_id = ?')
          .all(args[0]);
        break;

      case 'saasDbManager.getDashboardStats':
        const requestsToday = saasDbInstance
          .prepare('SELECT SUM(requests_today) as total FROM api_keys WHERE user_id = ?')
          .get(args[0]).total || 0;
        const pixPaid = saasDbInstance
          .prepare("SELECT COUNT(*) as total FROM pix_transactions WHERE user_id = ? AND status = 'COMPLETED'")
          .get(args[0]).total || 0;
        const pixExpired = saasDbInstance
          .prepare("SELECT COUNT(*) as total FROM pix_transactions WHERE user_id = ? AND status = 'EXPIRED'")
          .get(args[0]).total || 0;
        result = { requestsToday, pixPaid, pixExpired };
        break;

      case 'saasDbManager.getActivityLogs':
        result = saasDbInstance
          .prepare('SELECT timestamp, event_type, details FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC')
          .all(args[0]);
        break;

      case 'saasDbManager.getOnboardingStatus':
        result = saasDbInstance
          .prepare('SELECT onboarding_step FROM users WHERE id = ?')
          .get(args[0])?.onboarding_step;
        break;

      case 'saasDbManager.getUserPixTransactions': // Corrected
        result = saasDbInstance
          .prepare('SELECT * FROM pix_transactions WHERE user_id = ? ORDER BY id DESC')
          .all(args[0]);
        break;

      case 'saasDbManager.listUsers':
        result = saasDbInstance.prepare('SELECT * FROM users').all();
        break;

      case 'saasDbManager.getAdminStats':
        const totalUsers = saasDbInstance.prepare('SELECT COUNT(*) as total FROM users').get().total || 0;
        const totalKeys = saasDbInstance.prepare('SELECT COUNT(*) as total FROM api_keys').get().total || 0;
        const totalPix = saasDbInstance.prepare('SELECT COUNT(*) as total FROM pix_transactions').get().total || 0;
        result = { totalUsers, totalKeys, totalPix };
        break;

      case 'saasDbManager.regenerateApiKey':
        const newKey = `sk_${uuidv4().replace(/-/g, '')}`;
        saasDbInstance
          .prepare('UPDATE api_keys SET api_key = ? WHERE id = ?')
          .run(newKey, args[0]);
        result = newKey;
        break;

      case 'saasDbManager.updateUserOnboardingStep':
        saasDbInstance
          .prepare('UPDATE users SET onboarding_step = ? WHERE id = ?')
          .run(args[1], args[0]);
        break;

      case 'saasDbManager.updateUserFirstRequestMade':
        saasDbInstance
          .prepare('UPDATE users SET has_made_first_request = 1 WHERE id = ?')
          .run(args[0]);
        break;

      case 'saasDbManager.getAllApiKeys':
        result = saasDbInstance.prepare('SELECT * FROM api_keys').all();
        break;

      case 'saasDbManager.getAllPixTransactions':
        result = saasDbInstance.prepare('SELECT * FROM pix_transactions').all();
        break;

      default:
        throw new Error(`Task desconhecida: ${taskType}`);
    }
  } catch (err) {
    error = err.message;
  }

  parentPort.postMessage({
    taskId,
    result,
    error,
  });
});
