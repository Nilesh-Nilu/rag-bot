import { getOpenAI, isOpenAIConfigured } from "../config/openai.js";
import { searchSimilarChunks } from "./document.service.js";
import { saveMessage, getConversationHistory } from "./database.service.js";

const SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions based on uploaded documents.

## RULES:
1. Answer questions using ONLY the provided document context below.
2. If the answer is found in the documents, cite which document it came from.
3. If the documents don't contain relevant information, say so clearly — don't make up answers.
4. Be concise, accurate, and helpful.
5. If the user greets you, respond warmly and let them know they can ask questions about their uploaded documents.
6. Format responses clearly. Use bullet points or numbered lists when presenting multiple items.
7. When quoting from documents, use quotation marks.`;

export async function processChat(botId, message, sessionId) {
  if (!isOpenAIConfigured()) {
    throw new Error("OpenAI not configured");
  }

  const openai = getOpenAI();

  // Step 1: Search documents for relevant context
  const matches = await searchSimilarChunks(botId, message, 5);
  console.log(`   Found ${matches.length} relevant chunks`);

  const documentContext =
    matches.length > 0
      ? `\n\n## DOCUMENT CONTEXT:\n${matches
          .map(
            (m, i) =>
              `[Source: ${m.source}]\n${m.text}`
          )
          .join("\n\n---\n\n")}`
      : "\n\n## DOCUMENT CONTEXT:\nNo documents have been uploaded yet. Let the user know they can upload PDFs to get started.";

  // Step 2: Load conversation history
  const history = await getConversationHistory(botId, sessionId, 10);

  // Step 3: Save user message
  await saveMessage(botId, sessionId, "user", message);

  // Step 4: Build messages
  const systemPrompt = SYSTEM_PROMPT + documentContext;
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  // Step 5: Call OpenAI
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
    max_tokens: 1500,
  });

  const answer =
    response.choices[0].message.content ||
    "I couldn't process that request. Please try again.";

  // Step 6: Save assistant response
  await saveMessage(botId, sessionId, "assistant", answer);

  return {
    answer,
    sessionId,
    sources: matches.map((m) => ({
      file: m.source,
      relevance: Math.round(m.similarity * 100),
    })),
  };
}
