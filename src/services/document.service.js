import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { insertDocumentChunk, getDocumentChunks, clearDocuments } from "./database.service.js";

// ==================== TEXT EXTRACTION ====================

export async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// ==================== TEXT PROCESSING ====================

export function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
  }
  
  return chunks;
}

export function getTextVector(text) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const freq = {};
  words.forEach(word => {
    freq[word] = (freq[word] || 0) + 1;
  });
  return freq;
}

export function cosineSimilarity(vecA, vecB) {
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dotProduct = 0, magA = 0, magB = 0;

  for (const key of allKeys) {
    const a = vecA[key] || 0;
    const b = vecB[key] || 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ==================== DOCUMENT OPERATIONS ====================

export async function processDocument(botId, filePath, filename, mimetype) {
  // Extract text
  let text;
  if (mimetype === "application/pdf") {
    text = await extractPdfText(filePath);
  } else {
    text = await extractDocxText(filePath);
  }

  const cleanText = text.trim();
  if (cleanText.length < 50) {
    throw new Error("Could not extract meaningful text from document");
  }

  // Chunk and index
  const chunks = chunkText(cleanText);
  await clearDocuments(botId);

  for (const chunk of chunks) {
    const termFreq = getTextVector(chunk);
    await insertDocumentChunk(botId, chunk, termFreq, filename);
  }

  return { chunks: chunks.length, characters: cleanText.length };
}

export async function searchSimilarChunks(botId, query, limit = 5) {
  const queryVector = getTextVector(query);
  const chunks = await getDocumentChunks(botId);

  if (chunks.length === 0) return [];

  const scored = chunks.map(chunk => {
    const storedVector = JSON.parse(chunk.term_freq);
    const similarity = cosineSimilarity(queryVector, storedVector);
    return { text: chunk.chunk_text, source: chunk.source_file, similarity };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}

export default {
  extractPdfText,
  extractDocxText,
  chunkText,
  getTextVector,
  cosineSimilarity,
  processDocument,
  searchSimilarChunks,
};

