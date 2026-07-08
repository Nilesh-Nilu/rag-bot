import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import * as botController from "../controllers/bot.controller.js";
import * as documentController from "../controllers/document.controller.js";
import * as chatController from "../controllers/chat.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const uploadDir = join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Bot
router.post("/bots", botController.create);
router.get("/bots/:botId", botController.getInfo);

// Documents
router.post("/bots/:botId/upload", upload.single("pdf"), documentController.upload);
router.get("/bots/:botId/documents", documentController.listDocuments);
router.delete("/bots/:botId/documents", documentController.deleteDocument);

// Chat
router.post("/bots/:botId/chat", chatController.chat);
router.get("/bots/:botId/chat-history", chatController.getHistory);
router.post("/bots/:botId/clear-conversation", chatController.clearHistory);

// Health
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    openai: !!process.env.OPENAI_API_KEY,
  });
});

export default router;
