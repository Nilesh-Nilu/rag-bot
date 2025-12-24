import { Router } from 'express';
import { handleMCPRequest } from '../mcp/booking-mcp.js';
import { getTextVector } from '../../embedding.js';
import { searchSimilar } from '../../db.js';
import { generateAnswer } from '../../rag.js';

const router = Router();

router.post("/:botId/chat", async (req, res) => {
  try {
    const { botId } = req.params;
    const { message, language = 'en', sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(`\n💬 Chat [${sessionId}]: "${message}"`);

    // =====================================================
    // 🧠 MCP SERVER: Handle booking intents
    // =====================================================
    const mcpResult = await handleMCPRequest(botId, message, sessionId, language);
    
    if (mcpResult) {
      return res.json({
        answer: mcpResult.response,
        sources: 0,
        action: mcpResult.action,
        booking: mcpResult.booking,
        bookingId: mcpResult.bookingId
      });
    }

    // =====================================================
    // 📚 RAG: General questions fallback
    // =====================================================
    const queryTermFreq = getTextVector(message);
    const matches = await searchSimilar(botId, queryTermFreq);

    if (matches.length === 0) {
      return res.json({
        answer: language === 'hi' 
          ? "कोई जानकारी नहीं मिली। कृपया पहले PDF अपलोड करें।" 
          : "No information found. Please upload a PDF first.",
        sources: 0,
      });
    }

    const context = matches.map((m) => m.chunk_text).join("\n\n");
    const answer = await generateAnswer(message, context, language);

    res.json({ answer, sources: matches.length });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

export default router;
