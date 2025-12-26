const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../saas.db');
const db = new Database(dbPath);

const simpleDb = {
    initDb() {
        console.log('Initializing simpleDb...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('`users` table ensured in saas.db.');
    },

    findUserByUsername(username) {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    },

    findUserById(id) {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id);
    },

    createUser(username, passwordHash, role = 'user') {
        const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        const info = stmt.run(username, passwordHash, role);
        return info.lastInsertRowid;
    }
};

module.exports = simpleDb;
