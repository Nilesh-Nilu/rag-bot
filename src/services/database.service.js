import { v4 as uuidv4 } from "uuid";
import db from "../config/database.js";

// Helper for promisified db operations
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

export async function createBot(name, website) {
  const id = uuidv4();
  console.log(`   🗃️ DB: Creating bot "${name}" with ID: ${id}`);
  await runQuery(
    "INSERT INTO bots (id, name, website) VALUES (?, ?, ?)",
    [id, name, website]
  );
  console.log(`   ✅ DB: Bot created successfully`);
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

export async function insertDocumentChunk(botId, chunkText, termFreq, sourceFile) {
  const result = await runQuery(
    "INSERT INTO documents (bot_id, chunk_text, term_freq, source_file) VALUES (?, ?, ?, ?)",
    [botId, chunkText, JSON.stringify(termFreq), sourceFile]
  );
  return result.lastID;
}

export async function getDocumentChunks(botId) {
  console.log(`   🗃️ DB: Fetching document chunks for bot: ${botId}`);
  const chunks = await getAll(
    "SELECT id, chunk_text, term_freq, source_file FROM documents WHERE bot_id = ?",
    [botId]
  );
  console.log(`   ✅ DB: Found ${chunks.length} chunks`);
  return chunks;
}

export async function clearDocuments(botId) {
  const result = await runQuery("DELETE FROM documents WHERE bot_id = ?", [botId]);
  return result.changes;
}

// ==================== APPOINTMENT OPERATIONS ====================

export async function createAppointment(botId, data) {
  const id = uuidv4();
  console.log(`\n   🗃️ DB: Creating appointment...`);
  console.log(`      ID: ${id.slice(0, 8).toUpperCase()}`);
  console.log(`      Client: ${data.client_name}`);
  console.log(`      Phone: ${data.client_phone}`);
  console.log(`      Date: ${data.meeting_date}`);
  console.log(`      Time: ${data.meeting_time}`);
  
  await runQuery(
    `INSERT INTO appointments (id, bot_id, contact_person, client_name, client_phone, client_email, meeting_date, meeting_time, purpose)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, botId, data.contact_person, data.client_name, data.client_phone, data.client_email, data.meeting_date, data.meeting_time, data.purpose]
  );
  
  console.log(`   ✅ DB: Appointment saved to database!`);
  return { id, ...data };
}

export async function getAppointments(botId) {
  console.log(`   🗃️ DB: Fetching all appointments for bot: ${botId}`);
  const appointments = await getAll(
    "SELECT * FROM appointments WHERE bot_id = ? ORDER BY created_at DESC",
    [botId]
  );
  console.log(`   ✅ DB: Found ${appointments.length} appointments`);
  return appointments;
}

export async function getAppointmentsByPhone(botId, phone) {
  console.log(`   🗃️ DB: Searching appointments by phone: ${phone}`);
  const cleanPhone = phone.replace(/[\s\-\+]/g, "").replace(/^91/, "");
  console.log(`   🔍 Cleaned phone: ${cleanPhone}`);
  
  const appointments = await getAll(
    "SELECT * FROM appointments WHERE bot_id = ? AND (client_phone LIKE ? OR client_phone LIKE ?) ORDER BY created_at DESC",
    [botId, `%${cleanPhone}%`, `%${phone}%`]
  );
  
  console.log(`   ✅ DB: Found ${appointments.length} appointments`);
  return appointments;
}

export async function getAppointmentsByName(botId, name) {
  console.log(`   🗃️ DB: Searching appointments by name: ${name}`);
  const appointments = await getAll(
    "SELECT * FROM appointments WHERE bot_id = ? AND LOWER(client_name) LIKE LOWER(?) ORDER BY created_at DESC",
    [botId, `%${name}%`]
  );
  console.log(`   ✅ DB: Found ${appointments.length} appointments`);
  return appointments;
}

export async function cancelAppointment(appointmentId) {
  console.log(`   🗃️ DB: Cancelling appointment: ${appointmentId}`);
  const result = await runQuery(
    "UPDATE appointments SET status = 'cancelled' WHERE id = ?",
    [appointmentId]
  );
  console.log(`   ✅ DB: Appointment cancelled`);
  return result.changes > 0;
}

// ==================== CONVERSATION OPERATIONS ====================

export async function saveMessage(botId, sessionId, role, content) {
  console.log(`   🗃️ DB: Saving ${role} message to conversations table`);
  console.log(`      Session: ${sessionId.slice(0, 20)}...`);
  console.log(`      Content: "${content.substring(0, 50)}..."`);
  
  const result = await runQuery(
    "INSERT INTO conversations (bot_id, session_id, role, content) VALUES (?, ?, ?, ?)",
    [botId, sessionId, role, content]
  );
  
  console.log(`   ✅ DB: Message saved (ID: ${result.lastID})`);
  return result.lastID;
}

export async function getConversationHistory(botId, sessionId, limit = 50) {
  console.log(`   🗃️ DB: Loading conversation history`);
  console.log(`      Session: ${sessionId.slice(0, 20)}...`);
  console.log(`      Limit: ${limit} messages`);
  
  const rows = await getAll(
    "SELECT role, content FROM conversations WHERE bot_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT ?",
    [botId, sessionId, limit]
  );
  
  console.log(`   ✅ DB: Loaded ${rows.length} messages from history`);
  return rows.reverse();
}

export async function clearConversation(botId, sessionId) {
  console.log(`   🗃️ DB: Clearing conversation for session: ${sessionId}`);
  const result = await runQuery(
    "DELETE FROM conversations WHERE bot_id = ? AND session_id = ?",
    [botId, sessionId]
  );
  console.log(`   ✅ DB: Deleted ${result.changes} messages`);
  return result.changes;
}

export default {
  createBot,
  getBotById,
  insertDocumentChunk,
  getDocumentChunks,
  clearDocuments,
  createAppointment,
  getAppointments,
  getAppointmentsByPhone,
  getAppointmentsByName,
  cancelAppointment,
  saveMessage,
  getConversationHistory,
  clearConversation,
};
