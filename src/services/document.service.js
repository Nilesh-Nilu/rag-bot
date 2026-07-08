import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { getOpenAI } from "../config/openai.js";
import {
  insertDocumentChunk,
  getDocumentChunks,
  clearDocuments,
} from "./database.service.js";

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

// ==================== TEXT CHUNKING ====================

export function chunkText(text, chunkSize = 800, overlap = 200) {
  const sentences = text.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      current = overlapWords.join(" ") + " " + sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ==================== OPENAI EMBEDDINGS ====================

export async function getEmbedding(text) {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function getEmbeddings(texts) {
  const openai = getOpenAI();
  const batchSize = 100;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ==================== DOCUMENT PROCESSING ====================

export async function processDocument(botId, filePath, filename, mimetype) {
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

  const chunks = chunkText(cleanText);
  console.log(`   Chunked into ${chunks.length} pieces, generating embeddings...`);

  const embeddings = await getEmbeddings(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await insertDocumentChunk(botId, chunks[i], embeddings[i], filename, i);
  }

  return { chunks: chunks.length, characters: cleanText.length };
}

export async function searchSimilarChunks(botId, query, limit = 5) {
  const queryEmbedding = await getEmbedding(query);
  const chunks = await getDocumentChunks(botId);

  if (chunks.length === 0) return [];

  const scored = chunks.map((chunk) => {
    const storedEmbedding = JSON.parse(chunk.embedding);
    const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);
    return {
      text: chunk.chunk_text,
      source: chunk.source_file,
      similarity,
      chunkIndex: chunk.chunk_index,
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit).filter((s) => s.similarity > 0.2);
}
