import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

sqlite3.verbose();

const dataDir = join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, "rag.db");
export const db = new sqlite3.Database(dbPath);

export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS bots (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_id TEXT NOT NULL,
          chunk_text TEXT NOT NULL,
          embedding TEXT,
          source_file TEXT,
          chunk_index INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_documents_bot ON documents(bot_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(bot_id, session_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export default db;
