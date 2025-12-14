import sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import { cosineSimilarity } from "./embedding.js";

sqlite3.verbose();

export const db = new sqlite3.Database("rag.db");

// Initialize database with multi-tenant schema
db.serialize(() => {
  // Bots table (each SaaS customer gets a bot)
  db.run(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Documents table (stores chunks per bot)
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

  // Create index for faster queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_id ON documents(bot_id)`);
});

// Create a new bot
export function createBot(name, website) {
  return new Promise((resolve, reject) => {
    const botId = uuidv4();
    db.run(
      `INSERT INTO bots (id, name, website) VALUES (?, ?, ?)`,
      [botId, name, website],
      function (err) {
        if (err) reject(err);
        resolve(botId);
      }
    );
  });
}

// Get bot info
export function getBotInfo(botId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT b.*, COUNT(d.id) as document_count 
       FROM bots b 
       LEFT JOIN documents d ON b.id = d.bot_id 
       WHERE b.id = ? 
       GROUP BY b.id`,
      [botId],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  });
}

// Insert chunk for a specific bot
export function insertChunk(botId, chunkText, termFreq, sourceFile) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO documents (bot_id, chunk_text, term_freq, source_file) VALUES (?, ?, ?, ?)`,
      [botId, chunkText, JSON.stringify(termFreq), sourceFile],
      function (err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// Search similar chunks for a specific bot
export function searchSimilar(botId, queryTermFreq, limit = 5) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, chunk_text, term_freq, source_file FROM documents WHERE bot_id = ?`,
      [botId],
      (err, rows) => {
        if (err) return reject(err);

        if (rows.length === 0) {
          return resolve([]);
        }

        const scored = rows.map((row) => {
          const storedTermFreq = JSON.parse(row.term_freq);
          const similarity = cosineSimilarity(queryTermFreq, storedTermFreq);
          return { chunk_text: row.chunk_text, source_file: row.source_file, similarity };
        });

        scored.sort((a, b) => b.similarity - a.similarity);
        resolve(scored.slice(0, limit));
      }
    );
  });
}

// Delete all documents for a bot
export function clearBotDocuments(botId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM documents WHERE bot_id = ?`, [botId], function (err) {
      if (err) reject(err);
      resolve(this.changes);
    });
  });
}
