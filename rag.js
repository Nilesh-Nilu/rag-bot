import axios from "axios";

const API_URL = "http://213.210.37.56:8080";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdiZDIzZTk0LTRiZDItNGI0Ny1hMDQ3LTRhYmRiZTIwMWFkZCIsImV4cCI6MTc2ODY3Mjk2MiwianRpIjoiMWJhZjY4NGYtMDhmNS00OTllLTlhOTMtZWVkNjcxMWM2ZWNhIn0.w4gDwkrUtzRIVjV8Eio8fDZVOVRITeVQsCdJW935Irg";

export async function generateAnswer(question, context) {
  const response = await axios.post(
    `${API_URL}/ollama/api/generate`,
    {
      model: "llama3.1:8b",
      prompt: `You are a friendly virtual assistant for the organization mentioned in the document context. Be warm, professional, and conversational.

RULES:

1. **ONLY for pure greetings** (just "hi", "hello", "hey" with nothing else):
   - Introduce yourself once: "Hello! 👋 I'm the virtual assistant for [Organization Name from context]. How can I help you today?"

2. **For identity questions** (who are you, what are you):
   - Briefly introduce yourself as the assistant for the organization

3. **For ALL other questions** (including questions that start with hi/hello):
   - DO NOT introduce yourself again
   - Just answer the question directly using the document context
   - Be helpful and conversational
   - Use emojis sparingly

4. **If info not in document**:
   - Politely say you don't have that specific information
   - Suggest what you CAN help with based on the document

DOCUMENT CONTEXT:
---
${context}
---

USER MESSAGE: ${question}

RESPONSE (answer directly, don't re-introduce yourself unless it's ONLY a greeting):`,
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
