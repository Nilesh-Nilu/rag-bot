import axios from "axios";

const API_URL = "http://213.210.37.56:8080";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdiZDIzZTk0LTRiZDItNGI0Ny1hMDQ3LTRhYmRiZTIwMWFkZCIsImV4cCI6MTc2ODY3Mjk2MiwianRpIjoiMWJhZjY4NGYtMDhmNS00OTllLTlhOTMtZWVkNjcxMWM2ZWNhIn0.w4gDwkrUtzRIVjV8Eio8fDZVOVRITeVQsCdJW935Irg";

export async function generateAnswer(question, context, language = 'en') {
  const response = await axios.post(
    `${API_URL}/ollama/api/generate`,
    {
      model: "llama3.1:8b",
      prompt: `You are a concise assistant. Answer in ${language === 'hi' ? 'Hindi' : 'English'}.

RULES:
- MAX 2-3 sentences. Be brief and direct.
- NO greetings, NO filler words, NO "let me tell you"
- Extract key facts only. Skip fluff.
- If user asks for contact: show phone/email directly
- If info not found: say "I don't have that information."

CONTEXT:
${context}

Q: ${question}
A:`,
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
