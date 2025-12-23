import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractPdfText(path) {
  const buffer = fs.readFileSync(path);
  
  // Options to handle problematic PDFs
  const options = {
    // Disable strict mode for XRef parsing
    max: 0, // No page limit
  };
  
  try {
    const data = await pdfParse(buffer, options);
    return data.text;
  } catch (error) {
    // If standard parsing fails, try with pagerender disabled
    if (error.message.includes('XRef') || error.message.includes('xref')) {
      console.log('⚠️ XRef error, attempting alternative parsing...');
      
      // Try parsing without rendering (sometimes helps with corrupted XRefs)
      const fallbackOptions = {
        max: 0,
        pagerender: () => '', // Skip problematic page rendering
      };
      
      try {
        const data = await pdfParse(buffer, fallbackOptions);
        return data.text;
      } catch (fallbackError) {
        throw new Error(`PDF parsing failed: ${error.message}. This PDF may be corrupted, scanned, or in an unsupported format.`);
      }
    }
    throw error;
  }
}

export async function extractDocxText(path) {
  const buffer = fs.readFileSync(path);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
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

