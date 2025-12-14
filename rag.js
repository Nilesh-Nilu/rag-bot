import axios from "axios";
import { config } from "dotenv";

config();

const API_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

export async function generateAnswer(question, context) {
  const response = await axios.post(
    `${API_URL}/ollama/api/generate`,
    {
      model: "llama3.1:8b",
      prompt: `You are a document-based AI assistant. You MUST follow these rules strictly:

1. ONLY answer using information found in the provided context below
2. If the answer is NOT in the context, respond with: "I don't have information about that in the uploaded documents. Please ask something related to the document content."
3. Do NOT use any external knowledge or make assumptions
4. Do NOT provide general information that is not in the context
5. Always be helpful and accurate based solely on the document

DOCUMENT CONTEXT:
---
${context}
---

USER QUESTION: ${question}

ANSWER (based ONLY on the document above):`,
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.response;
}
