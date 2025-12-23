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

  // Bookings table (scheduled appointments per bot)
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      bot_id TEXT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      preferred_date DATE NOT NULL,
      preferred_time TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id)
    )
  `);

  // Create index for bookings queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_booking_bot_id ON bookings(bot_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_booking_date ON bookings(preferred_date)`);
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

// ============ BOOKING FUNCTIONS ============

// Create a new booking
export function createBooking(botId, bookingData) {
  return new Promise((resolve, reject) => {
    const bookingId = uuidv4();
    const { fullName, email, phone, service, preferredDate, preferredTime, notes } = bookingData;
    
    db.run(
      `INSERT INTO bookings (id, bot_id, full_name, email, phone, service, preferred_date, preferred_time, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, botId, fullName, email, phone, service, preferredDate, preferredTime, notes || null],
      function (err) {
        if (err) reject(err);
        resolve(bookingId);
      }
    );
  });
}

// Get booking by ID
export function getBooking(bookingId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM bookings WHERE id = ?`, [bookingId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

// Get all bookings for a bot
export function getBotBookings(botId, status = null) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM bookings WHERE bot_id = ?`;
    const params = [botId];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY preferred_date ASC, preferred_time ASC`;
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
}

// Update booking status
export function updateBookingStatus(bookingId, status) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, bookingId],
      function (err) {
        if (err) reject(err);
        resolve(this.changes);
      }
    );
  });
}

// Update booking details
export function updateBooking(bookingId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    
    if (updates.fullName) { fields.push('full_name = ?'); values.push(updates.fullName); }
    if (updates.email) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.phone) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.service) { fields.push('service = ?'); values.push(updates.service); }
    if (updates.preferredDate) { fields.push('preferred_date = ?'); values.push(updates.preferredDate); }
    if (updates.preferredTime) { fields.push('preferred_time = ?'); values.push(updates.preferredTime); }
    if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
    if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(bookingId);
    
    db.run(
      `UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`,
      values,
      function (err) {
        if (err) reject(err);
        resolve(this.changes);
      }
    );
  });
}

// Delete a booking
export function deleteBooking(bookingId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM bookings WHERE id = ?`, [bookingId], function (err) {
      if (err) reject(err);
      resolve(this.changes);
    });
  });
}

// Get bookings by date range
export function getBookingsByDateRange(botId, startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM bookings 
       WHERE bot_id = ? AND preferred_date BETWEEN ? AND ?
       ORDER BY preferred_date ASC, preferred_time ASC`,
      [botId, startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}
