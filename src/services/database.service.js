import { v4 as uuidv4 } from "uuid";
import db from "../config/database.js";

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ==================== BOT OPERATIONS ====================

export async function createBot(name) {
  const id = uuidv4();
  await runQuery("INSERT INTO bots (id, name) VALUES (?, ?)", [id, name]);
  return id;
}

export async function getBotById(botId) {
  return getOne(
    `SELECT b.*, COUNT(d.id) as document_count 
     FROM bots b 
     LEFT JOIN documents d ON b.id = d.bot_id 
     WHERE b.id = ? 
     GROUP BY b.id`,
    [botId]
  );
}

// ==================== DOCUMENT OPERATIONS ====================

export async function insertDocumentChunk(botId, chunkText, embedding, sourceFile, chunkIndex) {
  const result = await runQuery(
    "INSERT INTO documents (bot_id, chunk_text, embedding, source_file, chunk_index) VALUES (?, ?, ?, ?, ?)",
    [botId, chunkText, JSON.stringify(embedding), sourceFile, chunkIndex]
  );
  return result.lastID;
}

export async function getDocumentChunks(botId) {
  return getAll(
    "SELECT id, chunk_text, embedding, source_file, chunk_index FROM documents WHERE bot_id = ?",
    [botId]
  );
}

export async function clearDocuments(botId) {
  const result = await runQuery("DELETE FROM documents WHERE bot_id = ?", [botId]);
  return result.changes;
}

export async function getDocumentSources(botId) {
  return getAll(
    "SELECT DISTINCT source_file, COUNT(*) as chunks, MIN(created_at) as uploaded_at FROM documents WHERE bot_id = ? GROUP BY source_file ORDER BY uploaded_at DESC",
    [botId]
  );
}

export async function deleteDocumentBySource(botId, sourceFile) {
  const result = await runQuery(
    "DELETE FROM documents WHERE bot_id = ? AND source_file = ?",
    [botId, sourceFile]
  );
  return result.changes;
}

// ==================== CONVERSATION OPERATIONS ====================

export async function saveMessage(botId, sessionId, role, content) {
  const result = await runQuery(
    "INSERT INTO conversations (bot_id, session_id, role, content) VALUES (?, ?, ?, ?)",
    [botId, sessionId, role, content]
  );
  return result.lastID;
}

export async function getConversationHistory(botId, sessionId, limit = 50) {
  const rows = await getAll(
    "SELECT role, content FROM conversations WHERE bot_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT ?",
    [botId, sessionId, limit]
  );
  return rows.reverse();
}

export async function clearConversation(botId, sessionId) {
  const result = await runQuery(
    "DELETE FROM conversations WHERE bot_id = ? AND session_id = ?",
    [botId, sessionId]
  );
  return result.changes;
}
