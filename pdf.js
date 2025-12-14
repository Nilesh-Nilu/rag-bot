import fs from "fs";
import pdfParse from "pdf-parse";

export async function extractPdfText(path) {
  const buffer = fs.readFileSync(path);
  const data = await pdfParse(buffer);
  return data.text;
}

export function chunkText(text, chunkSize = 800, overlap = 100) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

