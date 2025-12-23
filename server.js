import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractPdfText, extractDocxText, chunkText } from "./pdf.js";
import { getTextVector } from "./embedding.js";
import { 
  createBot, insertChunk, searchSimilar, getBotInfo, clearBotDocuments,
  getAllDocumentText, getAppointments, saveConversationMessage, 
  getConversationHistory, clearConversationHistory
} from "./db.js";
import { toolDefinitions, executeTool } from "./mcpTools.js";
import gTTS from "gtts";

config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const allowedMimes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Create a new bot
app.post("/api/bots", async (req, res) => {
  try {
    const { name, website } = req.body;
    const botId = await createBot(name, website);
    res.json({ botId, message: "Bot created successfully" });
  } catch (error) {
    console.error("Error creating bot:", error);
    res.status(500).json({ error: "Failed to create bot" });
  }
});

// Upload document for a specific bot
app.post("/api/bots/:botId/upload", upload.single("pdf"), async (req, res) => {
  try {
    const { botId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`📘 Processing document: ${file.originalname}`);

    let text;
    if (file.mimetype === "application/pdf") {
      text = await extractPdfText(file.path);
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      text = await extractDocxText(file.path);
    } else {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const cleanText = text.trim();
    if (cleanText.length < 50) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        error: "Could not extract text from PDF.",
        extracted: cleanText.length
      });
    }

    console.log(`📄 Extracted ${cleanText.length} characters`);

    const chunks = chunkText(cleanText);
    console.log(`✂️ Created ${chunks.length} chunks`);

    await clearBotDocuments(botId);

    for (const chunk of chunks) {
      const termFreq = getTextVector(chunk);
      await insertChunk(botId, chunk, termFreq, file.originalname);
    }

    fs.unlinkSync(file.path);

    console.log(`✅ Successfully indexed ${chunks.length} chunks for bot ${botId}`);

    res.json({
      success: true,
      filename: file.originalname,
      chunks: chunks.length,
      characters: cleanText.length,
      message: "PDF processed successfully",
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: "Failed to process PDF: " + error.message });
  }
});

// =============================================
// UNIFIED CHAT ENDPOINT (Handles everything)
// =============================================

app.post("/api/bots/:botId/chat", async (req, res) => {
  try {
    const { botId } = req.params;
    const { message, sessionId, language = 'en' } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const session = sessionId || `session_${Date.now()}`;

    // Get RAG context from uploaded documents
    const queryTermFreq = getTextVector(message);
    const matches = await searchSimilar(botId, queryTermFreq, 5);
    
    if (matches.length === 0) {
      const noDocsMsg = language === 'hi' 
        ? "कृपया पहले एक PDF अपलोड करें ताकि मैं आपकी मदद कर सकूं।"
        : "Please upload a PDF document first so I can help you.";
      return res.json({ answer: noDocsMsg, sessionId: session, sources: 0 });
    }

    const ragContext = matches.map(m => m.chunk_text).join("\n\n");

    // If Gemini is not configured, use simple RAG response
    if (!genAI) {
      // Fallback to existing RAG system
      const { generateAnswer } = await import("./rag.js");
      const answer = await generateAnswer(message, ragContext, language);
      return res.json({ answer, sessionId: session, sources: matches.length });
    }

    // Get conversation history
    const history = await getConversationHistory(botId, session, 6);

    // Save user message
    await saveConversationMessage(botId, session, "user", message);

    // Build chat with Gemini + Tools
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{
        functionDeclarations: toolDefinitions.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }]
    });

    const systemPrompt = `You are a helpful clinic assistant. You answer questions about the clinic AND help book appointments.

LANGUAGE: ${language === 'hi' ? 'Respond in Hindi (हिंदी). Use feminine grammar (मैं आपकी मदद कर सकती हूं).' : 'Respond in English.'}

YOUR CAPABILITIES:
1. Answer questions about the clinic, doctors, services, timings from the document
2. Help patients book appointments with doctors mentioned in the document
3. Show patient's existing appointments
4. Cancel appointments

CLINIC DOCUMENT (Use this information):
---
${ragContext}
---

APPOINTMENT BOOKING RULES:
- ONLY book appointments with doctors mentioned in the document above
- When user wants to book, collect ALL these details one by one:
  1. Which doctor they want (from document)
  2. Patient's full name
  3. Phone number (10 digits)
  4. Age
  5. Gender (Male/Female/Other)
  6. Preferred date
  7. Preferred time
  8. Symptoms/reason (optional)
- Once you have ALL details, use book_appointment tool
- Confirm booking details before using the tool

CONVERSATION STYLE:
- Be warm, friendly, professional
- Keep responses concise (2-4 sentences)
- Ask one question at a time when collecting info
- Format doctor info nicely when listing

PREVIOUS CONVERSATION:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}

Respond naturally to the user's message.`;

    const chat = model.startChat({
      history: [],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    });

    let result = await chat.sendMessage(`${systemPrompt}\n\nUser: ${message}`);
    let response = result.response;
    
    // Handle function calls
    let maxIterations = 3;
    let iterations = 0;
    
    while (response.functionCalls() && iterations < maxIterations) {
      iterations++;
      const functionCalls = response.functionCalls();
      
      const toolResults = [];
      for (const call of functionCalls) {
        console.log(`🔧 Tool call: ${call.name}`);
        const toolResult = await executeTool(botId, call.name, call.args);
        toolResults.push({
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        });
      }

      result = await chat.sendMessage(toolResults);
      response = result.response;
    }

    const answer = response.text();
    
    // Save assistant response
    await saveConversationMessage(botId, session, "assistant", answer);

    res.json({ 
      answer, 
      sessionId: session,
      sources: matches.length 
    });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ 
      error: "Failed to process request",
      answer: "Sorry, I encountered an error. Please try again."
    });
  }
});

// Get appointments
app.get("/api/bots/:botId/appointments", async (req, res) => {
  try {
    const { botId } = req.params;
    const appointments = await getAppointments(botId);
    res.json({ appointments });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// Clear conversation
app.post("/api/bots/:botId/clear-conversation", async (req, res) => {
  try {
    const { botId } = req.params;
    const { sessionId } = req.body;
    if (sessionId) {
      await clearConversationHistory(botId, sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear conversation" });
  }
});

// Get bot info
app.get("/api/bots/:botId", async (req, res) => {
  try {
    const { botId } = req.params;
    const bot = await getBotInfo(botId);
    if (!bot) {
      return res.status(404).json({ error: "Bot not found" });
    }
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: "Failed to get bot info" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", geminiConfigured: !!process.env.GEMINI_API_KEY });
});

// TTS endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, lang = 'en-uk' } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const tts = new gTTS(text, lang);
    const chunks = [];
    const stream = tts.stream();
    
    stream.on('data', (chunk) => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    
    const audioBuffer = Buffer.concat(chunks);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'no-cache',
    });
    
    res.send(audioBuffer);
  } catch (error) {
    console.error("TTS Error:", error.message);
    res.status(500).json({ error: "TTS failed" });
  }
});

// Serve widget files
app.use("/widget", express.static("widget"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 RAG SaaS API running on http://localhost:${PORT}`);
  console.log(`📅 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '⚠️ Set GEMINI_API_KEY in .env'}`);
});
