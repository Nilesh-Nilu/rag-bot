import "dotenv/config";
import app from "./src/app.js";
import { initializeDatabase } from "./src/config/database.js";
import { initializeOpenAI } from "./src/config/openai.js";

const PORT = process.env.PORT || 3001;

async function start() {
  console.log("\nStarting PDF RAG Server...\n");

  try {
    await initializeDatabase();
    console.log("Database initialized");
  } catch (err) {
    console.error("Database error:", err.message);
    process.exit(1);
  }

  if (initializeOpenAI()) {
    console.log("OpenAI configured");
  } else {
    console.warn("OpenAI not configured — set OPENAI_API_KEY in .env");
  }

  app.listen(PORT, () => {
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api\n`);
  });
}

start().catch(console.error);
