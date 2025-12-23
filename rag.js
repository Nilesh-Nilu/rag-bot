import axios from "axios";

const API_URL = "http://213.210.37.56:8080";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdiZDIzZTk0LTRiZDItNGI0Ny1hMDQ3LTRhYmRiZTIwMWFkZCIsImV4cCI6MTc2ODY3Mjk2MiwianRpIjoiMWJhZjY4NGYtMDhmNS00OTllLTlhOTMtZWVkNjcxMWM2ZWNhIn0.w4gDwkrUtzRIVjV8Eio8fDZVOVRITeVQsCdJW935Irg";

export async function generateAnswer(question, context, language = 'en') {
  const langInstructions = language === 'hi' 
    ? `
IMPORTANT: You MUST respond in PERFECT Hindi (हिंदी) with correct FEMININE grammar.
- Use proper FEMININE Hindi grammar (you are female/woman)
- CORRECT: "मैं आपकी मदद कर सकती हूं" (female form)
- CORRECT: "मैं यहां हूं" 
- Use "सकती हूं" NOT "सकता हूं" (female)
- Use "करती हूं" NOT "करता हूं" (female)
- Speak like a helpful Indian woman
- Use complete, grammatically correct sentences
- Be warm and conversational`
    : `
IMPORTANT: Respond in PERFECT English with correct grammar.
- You are a FEMALE assistant - speak like a helpful woman
- Use proper English grammar and complete sentences
- Be conversational but grammatically correct
- Be warm and friendly`;

  const response = await axios.post(
    `${API_URL}/ollama/api/generate`,
    {
      model: "llama3.1:8b",
      prompt: `You are a helpful female virtual assistant having a natural conversation. 

${langInstructions}

STYLE GUIDELINES:
- Use simple, clear language
- Keep sentences short (8-12 words max)
- Be conversational but professional  
- Use proper grammar and punctuation
- Add natural pauses with commas and periods

ANSWER RULES:
1. For greetings: Be warm and welcoming
2. For questions: Answer clearly using the document context
3. If info not in document: Politely say so and suggest what you CAN help with
4. Always be helpful and friendly

DOCUMENT CONTEXT:
---
${context}
---

USER: ${question}

RESPONSE (grammatically correct, natural ${language === 'hi' ? 'Hindi' : 'English'}):`,
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
