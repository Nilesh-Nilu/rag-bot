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

  // =============================================
  // APPOINTMENT BOOKING SYSTEM TABLES
  // =============================================

  // Doctors extracted from documents
  db.run(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      bot_id TEXT,
      name TEXT NOT NULL,
      specialty TEXT,
      qualifications TEXT,
      experience_years INTEGER,
      consultation_fee REAL,
      available_days TEXT,
      available_hours TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id)
    )
  `);

  // Appointments table
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      bot_id TEXT,
      doctor_name TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      patient_email TEXT,
      patient_age INTEGER,
      patient_gender TEXT,
      patient_symptoms TEXT,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id)
    )
  `);

  // Conversation history for booking context
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

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_doctors_bot ON doctors(bot_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_bot ON appointments(bot_id)`);
});

// =============================================
// BOT FUNCTIONS
// =============================================

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

// Get all document text for a bot (for extracting info)
export function getAllDocumentText(botId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT chunk_text FROM documents WHERE bot_id = ? ORDER BY id`,
      [botId],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows ? rows.map(r => r.chunk_text).join('\n\n') : '');
      }
    );
  });
}

export function clearBotDocuments(botId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM documents WHERE bot_id = ?`, [botId], function (err) {
      if (err) reject(err);
      resolve(this.changes);
    });
  });
}

// =============================================
// DOCTOR FUNCTIONS (from documents)
// =============================================

export function addDoctor(botId, doctor) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      `INSERT INTO doctors (id, bot_id, name, specialty, qualifications, experience_years, consultation_fee, available_days, available_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, botId, doctor.name, doctor.specialty, doctor.qualifications, doctor.experience_years, doctor.consultation_fee, doctor.available_days, doctor.available_hours],
      function (err) {
        if (err) reject(err);
        resolve({ id, ...doctor });
      }
    );
  });
}

export function getDoctors(botId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM doctors WHERE bot_id = ? AND is_active = 1 ORDER BY name`,
      [botId],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });
}

export function clearDoctors(botId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM doctors WHERE bot_id = ?`, [botId], function (err) {
      if (err) reject(err);
      resolve(this.changes);
    });
  });
}

// =============================================
// APPOINTMENT FUNCTIONS
// =============================================

export function createAppointment(botId, appointment) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      `INSERT INTO appointments 
       (id, bot_id, doctor_name, patient_name, patient_phone, patient_email, patient_age, patient_gender, patient_symptoms, appointment_date, appointment_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, botId, appointment.doctor_name, appointment.patient_name,
        appointment.patient_phone, appointment.patient_email,
        appointment.patient_age, appointment.patient_gender,
        appointment.patient_symptoms, appointment.appointment_date,
        appointment.appointment_time
      ],
      function (err) {
        if (err) reject(err);
        resolve({ id, ...appointment });
      }
    );
  });
}

export function getAppointments(botId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM appointments WHERE bot_id = ? ORDER BY created_at DESC`,
      [botId],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });
}

// Search appointments by phone number
export function getAppointmentsByPhone(botId, phone) {
  return new Promise((resolve, reject) => {
    // Clean phone number - remove spaces, dashes, +91 etc.
    const cleanPhone = phone.replace(/[\s\-\+]/g, '').replace(/^91/, '');
    db.all(
      `SELECT * FROM appointments WHERE bot_id = ? AND (patient_phone LIKE ? OR patient_phone LIKE ?) ORDER BY created_at DESC`,
      [botId, `%${cleanPhone}%`, `%${phone}%`],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });
}

// Search appointments by patient name
export function getAppointmentsByName(botId, name) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM appointments WHERE bot_id = ? AND LOWER(patient_name) LIKE LOWER(?) ORDER BY created_at DESC`,
      [botId, `%${name}%`],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });
}

export function getAppointmentById(appointmentId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM appointments WHERE id = ?`, [appointmentId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

export function cancelAppointment(appointmentId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE appointments SET status = 'cancelled' WHERE id = ?`,
      [appointmentId],
      function (err) {
        if (err) reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

// =============================================
// CONVERSATION FUNCTIONS
// =============================================

export function saveConversationMessage(botId, sessionId, role, content) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO conversations (bot_id, session_id, role, content) VALUES (?, ?, ?, ?)`,
      [botId, sessionId, role, content],
      function (err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

export function getConversationHistory(botId, sessionId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT role, content FROM conversations 
       WHERE bot_id = ? AND session_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [botId, sessionId, limit],
      (err, rows) => {
        if (err) reject(err);
        resolve((rows || []).reverse());
      }
    );
  });
}

export function clearConversationHistory(botId, sessionId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM conversations WHERE bot_id = ? AND session_id = ?`,
      [botId, sessionId],
      function (err) {
        if (err) reject(err);
        resolve(this.changes);
      }
    );
  });
}
