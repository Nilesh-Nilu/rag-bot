import { extractPdfText, chunkText } from "./pdf.js";
import { getTextVector } from "./embedding.js";
import { insertChunk, searchSimilar } from "./db.js";
import { generateAnswer } from "./rag.js";

(async () => {
  console.log("📘 Extracting PDF...");
  const text = await extractPdfText("./docs/clinic_demo.pdf");

  console.log("✂️ Chunking...");
  const chunks = chunkText(text);

  console.log("🧠 Indexing chunks (keyword-based)...");
  for (const chunk of chunks) {
    const termFreq = getTextVector(chunk);
    await insertChunk(chunk, termFreq);
  }

  console.log("✅ Knowledge base ready.\n");

  // Test with multiple questions
  const questions = [
    "What are the clinic's operating hours?",
    "What services does the clinic offer?",
    // "How can I book an appointment?"
  ];

  for (const query of questions) {
    console.log("━".repeat(50));
    console.log(`❓ QUESTION: ${query}`);
    console.log("━".repeat(50));

    const queryTermFreq = getTextVector(query);
    const matches = await searchSimilar(queryTermFreq);
    const context = matches.map(m => m.chunk_text).join("\n\n");

    const answer = await generateAnswer(query, context);
    console.log(`\n💬 ANSWER:\n${answer}\n`);
  }
})();
