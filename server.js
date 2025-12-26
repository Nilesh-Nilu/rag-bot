import "dotenv/config";
import app from "./src/app.js";
import { initializeDatabase } from "./src/config/database.js";
import { initializeOpenAI } from "./src/config/openai.js";

const PORT = process.env.PORT || 3001;

async function start() {
  console.log("\n🚀 Starting RAG Bot Server...\n");

  // Initialize database
  try {
    await initializeDatabase();
    console.log("✅ Database initialized");
  } catch (err) {
    console.error("❌ Database error:", err.message);
    process.exit(1);
  }

  // Initialize OpenAI
  if (initializeOpenAI()) {
    console.log("✅ OpenAI configured");
  } else {
    console.log("⚠️  OpenAI not configured (set OPENAI_API_KEY in .env)");
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`\n🌐 Server running at http://localhost:${PORT}`);
    console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
    console.log("\n📝 Available routes:");
    console.log("   POST /api/bots              - Create bot");
    console.log("   GET  /api/bots/:id          - Get bot info");
    console.log("   POST /api/bots/:id/upload   - Upload document");
    console.log("   POST /api/bots/:id/chat     - Chat");
    console.log("   GET  /api/health            - Health check\n");
  });
}

start().catch(console.error);
