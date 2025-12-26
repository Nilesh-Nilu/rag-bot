import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

sqlite3.verbose();

// Database path at project root
const dbPath = join(__dirname, "../../data/rag.db");

export const db = new sqlite3.Database(dbPath);

// Initialize tables
export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Bots table
      db.run(`
        CREATE TABLE IF NOT EXISTS bots (
          id TEXT PRIMARY KEY,
          name TEXT,
          website TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Documents table
      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_id TEXT,
          chunk_text TEXT,
          term_freq TEXT,
          source_file TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id)
        )
      `);

      // Leads table for capturing potential customers
      db.run(`
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          bot_id TEXT,
          session_id TEXT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          company TEXT,
          service_interest TEXT,
          project_type TEXT,
          budget_range TEXT,
          timeline TEXT,
          inquiry TEXT,
          lead_status TEXT DEFAULT 'new',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id)
        )
      `);

      // Appointments table
      db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
          id TEXT PRIMARY KEY,
          bot_id TEXT,
          lead_id TEXT,
          contact_person TEXT NOT NULL,
          client_name TEXT NOT NULL,
          client_phone TEXT,
          client_email TEXT,
          company_name TEXT,
          meeting_type TEXT,
          meeting_date TEXT NOT NULL,
          meeting_time TEXT NOT NULL,
          purpose TEXT,
          status TEXT DEFAULT 'confirmed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id),
          FOREIGN KEY (lead_id) REFERENCES leads(id)
        )
      `);

      // Cost estimates table
      db.run(`
        CREATE TABLE IF NOT EXISTS cost_estimates (
          id TEXT PRIMARY KEY,
          bot_id TEXT,
          session_id TEXT,
          project_type TEXT,
          complexity TEXT,
          estimated_cost TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id)
        )
      `);

      // Conversations table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_id TEXT,
          session_id TEXT,
          role TEXT,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bot_id) REFERENCES bots(id)
        )
      `);

      // Indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_documents_bot ON documents(bot_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_bot ON appointments(bot_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_leads_bot ON leads(bot_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(bot_id, session_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export default db;
