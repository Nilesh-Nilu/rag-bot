import { processChat } from "../services/chat.service.js";
import { getConversationHistory, clearConversation } from "../services/database.service.js";
import { isOpenAIConfigured } from "../config/openai.js";

export async function chat(req, res) {
  const startTime = Date.now();
  
  console.log("\n" + "=".repeat(60));
  console.log("📨 INCOMING CHAT REQUEST");
  console.log("=".repeat(60));
  
  try {
    const { botId } = req.params;
    const { message, sessionId, language = "en" } = req.body;

    console.log("📋 Request Details:");
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Session: ${sessionId || "new session"}`);
    console.log(`   Language: ${language}`);
    console.log(`   Message: "${message}"`);

    if (!message) {
      console.log("❌ Error: No message provided");
      return res.status(400).json({ error: "Message is required" });
    }

    if (!isOpenAIConfigured()) {
      console.log("❌ Error: OpenAI not configured");
      return res.status(500).json({
        error: "OpenAI not configured",
        answer: "Please configure OPENAI_API_KEY in .env file",
      });
    }

    console.log("\n🚀 Starting chat processing...");
    const session = sessionId || `session_${Date.now()}`;
    const result = await processChat(botId, message, session, language);

    const duration = Date.now() - startTime;
    console.log("\n" + "=".repeat(60));
    console.log("✅ RESPONSE SENT");
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Answer: "${result.answer.substring(0, 100)}..."`);
    console.log("=".repeat(60) + "\n");

    res.json(result);
  } catch (error) {
    console.error("\n❌ CHAT ERROR:", error.message);
    console.error("   Stack:", error.stack);
    res.status(500).json({
      error: "Failed to process message",
      answer: "Sorry, an error occurred. Please try again.",
    });
  }
}

export async function getHistory(req, res) {
  try {
    const { botId } = req.params;
    const { sessionId } = req.query;

    console.log(`📜 Loading chat history for session: ${sessionId}`);

    if (!sessionId) {
      return res.json({ messages: [] });
    }

    const messages = await getConversationHistory(botId, sessionId, 50);
    console.log(`   Found ${messages.length} messages`);
    
    res.json({ messages });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Failed to get chat history" });
  }
}

export async function clearHistory(req, res) {
  try {
    const { botId } = req.params;
    const { sessionId } = req.body;

    console.log(`🗑️ Clearing chat history for session: ${sessionId}`);

    if (sessionId) {
      await clearConversation(botId, sessionId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Clear history error:", error);
    res.status(500).json({ error: "Failed to clear conversation" });
  }
}

export default { chat, getHistory, clearHistory };
