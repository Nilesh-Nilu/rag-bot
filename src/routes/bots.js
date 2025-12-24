import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { extractPdfText, extractDocxText, chunkText } from '../../pdf.js';
import { getTextVector } from '../../embedding.js';
import { createBot, insertChunk, getBotInfo, clearBotDocuments } from '../../db.js';

const router = Router();

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Create a new bot
router.post("/", async (req, res) => {
  try {
    const { name, website } = req.body;
    const botId = await createBot(name, website);
    res.json({ botId, message: "Bot created successfully" });
  } catch (error) {
    console.error("Error creating bot:", error);
    res.status(500).json({ error: "Failed to create bot" });
  }
});

// Upload document
router.post("/:botId/upload", upload.single("pdf"), async (req, res) => {
  try {
    const { botId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`📘 Processing: ${file.originalname}`);

    let text;
    if (file.mimetype === "application/pdf") {
      text = await extractPdfText(file.path);
    } else {
      text = await extractDocxText(file.path);
    }

    const cleanText = text.trim();
    if (cleanText.length < 50) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Could not extract text from PDF" });
    }

    const chunks = chunkText(cleanText);
    await clearBotDocuments(botId);

    for (const chunk of chunks) {
      const termFreq = getTextVector(chunk);
      await insertChunk(botId, chunk, termFreq, file.originalname);
    }

    fs.unlinkSync(file.path);
    console.log(`✅ Indexed ${chunks.length} chunks for bot ${botId}`);

    res.json({
      success: true,
      filename: file.originalname,
      chunks: chunks.length,
      characters: cleanText.length,
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

// Get bot info
router.get("/:botId", async (req, res) => {
  try {
    const bot = await getBotInfo(req.params.botId);
    if (!bot) {
      return res.status(404).json({ error: "Bot not found" });
    }
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: "Failed to get bot info" });
  }
});

export default router;

