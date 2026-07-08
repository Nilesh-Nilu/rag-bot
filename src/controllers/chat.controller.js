import { processChat } from "../services/chat.service.js";
import { getConversationHistory, clearConversation } from "../services/database.service.js";
import { isOpenAIConfigured } from "../config/openai.js";

export async function chat(req, res) {
  try {
    const { botId } = req.params;
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!isOpenAIConfigured()) {
      return res.status(500).json({
        error: "OpenAI not configured",
        answer: "Please configure OPENAI_API_KEY in .env file",
      });
    }

    const session = sessionId || `session_${Date.now()}`;
    const result = await processChat(botId, message, session);
    res.json(result);
  } catch (error) {
    console.error("Chat error:", error.message);
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
    if (!sessionId) return res.json({ messages: [] });

    const messages = await getConversationHistory(botId, sessionId, 50);
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
    if (sessionId) await clearConversation(botId, sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Clear history error:", error);
    res.status(500).json({ error: "Failed to clear conversation" });
  }
}
