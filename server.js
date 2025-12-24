import express from "express";
import cors from "cors";
import { PORT } from "./src/config.js";
import { startSessionCleanup } from "./src/session.js";

// Import routes
import botsRouter from "./src/routes/bots.js";
import chatRouter from "./src/routes/chat.js";
import bookingsRouter from "./src/routes/bookings.js";
import ttsRouter from "./src/routes/tts.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// =====================================================
// 🚀 API ROUTES
// =====================================================

// Bot management (create, upload docs, get info)
app.use("/api/bots", botsRouter);

// Chat endpoint (MCP server)
app.use("/api/bots", chatRouter);

// Booking management
app.use("/api", bookingsRouter);

// Text-to-Speech
app.use("/api/tts", ttsRouter);

// =====================================================
// 📌 UTILITY ENDPOINTS
// =====================================================

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve widget files
app.use("/widget", express.static("widget"));

// =====================================================
// 🏁 START SERVER
// =====================================================

// Start session cleanup interval
startSessionCleanup();

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  🚀 RAG SaaS API running on http://localhost:${PORT}     ║
╠═══════════════════════════════════════════════════════╣
║  📁 Modules loaded:                                   ║
║     • /api/bots       - Bot management                ║
║     • /api/bots/:id/chat - MCP Chat server            ║
║     • /api/bookings   - Booking management            ║
║     • /api/tts        - Text-to-Speech                ║
╚═══════════════════════════════════════════════════════╝
  `);
});
