import fs from "fs";
import { processDocument } from "../services/document.service.js";

export async function upload(req, res) {
  try {
    const { botId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`📘 Processing: ${file.originalname}`);

    const result = await processDocument(botId, file.path, file.originalname, file.mimetype);

    // Cleanup uploaded file
    fs.unlinkSync(file.path);

    console.log(`✅ Indexed ${result.chunks} chunks`);

    res.json({
      success: true,
      filename: file.originalname,
      chunks: result.chunks,
      characters: result.characters,
    });
  } catch (error) {
    console.error("Upload error:", error);
    
    // Cleanup on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: error.message || "Failed to process document" });
  }
}

export default { upload };

