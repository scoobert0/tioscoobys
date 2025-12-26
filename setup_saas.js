const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('saas.db');

const SALT_ROUNDS = 10;

function setupDatabase() {
  console.log('Setting up SaaS database...');

  // Create users table (if not exists)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('`users` table schema ensured.');

  // Create a default admin user if it doesn't exist
  const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin_user');
  if (!adminUser) {
    console.log('Creating default admin user...');
    const adminPassword = 'adminpassword';
    const passwordHash = bcrypt.hashSync(adminPassword, SALT_ROUNDS);
    
    // Let SQLite auto-assign the ID
    const insertUser = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    insertUser.run('admin_user', passwordHash, 'admin');
    
    console.log('Default admin user created with password: adminpassword');

  } else {
    console.log(`Default admin user ('${adminUser.username}') already exists.`);
  }

  db.close();
  console.log('Database setup complete.');
}

setupDatabase();
