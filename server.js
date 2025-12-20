import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "dotenv";
import { extractPdfText, extractDocxText, chunkText } from "./pdf.js";
import { getTextVector } from "./embedding.js";
import { createBot, insertChunk, searchSimilar, getBotInfo, clearBotDocuments } from "./db.js";
import { generateAnswer } from "./rag.js";

config();

const app = express();
app.use(cors());
app.use(express.json());

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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Create a new bot (for SaaS - each customer gets a bot)
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

    // Extract text based on file type
    let text;
    if (file.mimetype === "application/pdf") {
      text = await extractPdfText(file.path);
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      text = await extractDocxText(file.path);
    } else {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // Check if we got meaningful text
    const cleanText = text.trim();
    if (cleanText.length < 50) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        error: "Could not extract text from PDF. Make sure it's a text-based PDF, not a scanned image.",
        extracted: cleanText.length
      });
    }

    console.log(`📄 Extracted ${cleanText.length} characters`);

    // Chunk the text
    const chunks = chunkText(cleanText);
    console.log(`✂️ Created ${chunks.length} chunks`);

    // Clear previous documents for this bot (optional - replace existing)
    await clearBotDocuments(botId);

    // Index chunks
    for (const chunk of chunks) {
      const termFreq = getTextVector(chunk);
      await insertChunk(botId, chunk, termFreq, file.originalname);
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    console.log(`✅ Successfully indexed ${chunks.length} chunks for bot ${botId}`);

    res.json({
      success: true,
      filename: file.originalname,
      chunks: chunks.length,
      characters: cleanText.length,
      message: "PDF processed and indexed successfully",
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: "Failed to process PDF: " + error.message });
  }
});

// Chat endpoint for a specific bot
app.post("/api/bots/:botId/chat", async (req, res) => {
  try {
    const { botId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Search for relevant chunks
    const queryTermFreq = getTextVector(message);
    const matches = await searchSimilar(botId, queryTermFreq);

    if (matches.length === 0) {
      return res.json({
        answer: "No documents have been uploaded yet. Please upload a PDF first.",
        sources: 0,
      });
    }

    const context = matches.map((m) => m.chunk_text).join("\n\n");
    
    console.log(`🔍 Found ${matches.length} relevant chunks for query: "${message.substring(0, 50)}..."`);

    // Generate answer
    const answer = await generateAnswer(message, context);

    res.json({ answer, sources: matches.length });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Failed to generate response" });
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
  res.json({ status: "ok" });
});

// Serve widget files
app.use("/widget", express.static("widget"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 RAG SaaS API running on http://localhost:${PORT}`);
});
