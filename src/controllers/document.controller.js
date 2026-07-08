import fs from "fs";
import { processDocument } from "../services/document.service.js";
import { getDocumentSources, deleteDocumentBySource } from "../services/database.service.js";

export async function upload(req, res) {
  try {
    const { botId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`Processing: ${file.originalname}`);
    const result = await processDocument(botId, file.path, file.originalname, file.mimetype);

    fs.unlinkSync(file.path);
    console.log(`Indexed ${result.chunks} chunks from ${file.originalname}`);

    res.json({
      success: true,
      filename: file.originalname,
      chunks: result.chunks,
      characters: result.characters,
    });
  } catch (error) {
    console.error("Upload error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || "Failed to process document" });
  }
}

export async function listDocuments(req, res) {
  try {
    const { botId } = req.params;
    const documents = await getDocumentSources(botId);
    res.json({ documents });
  } catch (error) {
    console.error("List documents error:", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
}

export async function deleteDocument(req, res) {
  try {
    const { botId } = req.params;
    const { sourceFile } = req.body;
    if (!sourceFile) return res.status(400).json({ error: "sourceFile is required" });

    const deleted = await deleteDocumentBySource(botId, sourceFile);
    res.json({ success: true, deletedChunks: deleted });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
}
