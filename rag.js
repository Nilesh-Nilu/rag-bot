import axios from "axios";

const API_URL = "http://213.210.37.56:8080";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdiZDIzZTk0LTRiZDItNGI0Ny1hMDQ3LTRhYmRiZTIwMWFkZCIsImV4cCI6MTc2ODY3Mjk2MiwianRpIjoiMWJhZjY4NGYtMDhmNS00OTllLTlhOTMtZWVkNjcxMWM2ZWNhIn0.w4gDwkrUtzRIVjV8Eio8fDZVOVRITeVQsCdJW935Irg";

export async function generateAnswer(question, context, language = 'en') {
  const langInstructions = language === 'hi' 
    ? `
IMPORTANT: You MUST respond in NATURAL, CONVERSATIONAL Hindi (हिंदी) with correct FEMININE grammar.
- Use a warm, human tone. Avoid sounding like a machine.
- Use natural expressions like "जी बिल्कुल," "देखिए," "मैं आपकी बात समझ सकती हूं," or "ठीक है."
- ALWAYS use FEMININE forms: "सकती हूं" (not सकता), "करूंगी" (not करूंगा).
- Imagine you are a friendly Indian woman talking to a guest.`
    : `
IMPORTANT: Respond in NATURAL, WARM English.
- Use contractions like "I'm," "don't," "it's" to sound more conversational.
- Use friendly bridge phrases like "Well, let me see," "Actually," "I'd be glad to help with that," or "That's a good question."
- Speak like a helpful person, not a textbook.`;

  const response = await axios.post(
    `${API_URL}/ollama/api/generate`,
    {
      model: "llama3.1:8b",
      prompt: `You are a warm, helpful female virtual assistant with a "human touch".

${langInstructions}

CRITICAL RULES:
1. CONTACT REQUESTS: When user wants to "talk", "speak", "call", "contact", or "reach" someone:
   - ALWAYS show the ACTUAL phone numbers and email from the document
   - Format: "You can reach us at: Phone: [number] | Email: [email]"
   - Then offer: "Or I can help you schedule a call - just say 'book appointment'!"
   - NEVER just say "check the website" - give the actual details!

2. SPECIFIC DATA: Always include specific details (numbers, emails, addresses) when available in context.

3. BOOKING: If user wants to book/schedule, tell them to click the booking button or say "book appointment".

STYLE GUIDELINES:
- Use natural flow. Avoid numbered lists unless strictly necessary.
- Add small natural "breaths" in text (e.g., "Well,..." or "...you know?")
- Vary sentence length to sound more rhythmic.
- If information isn't available, say something like "Hmm, I don't see that here, but I can definitely tell you about..."

DOCUMENT CONTEXT:
---
${context}
---

USER: ${question}

RESPONSE (natural, conversational, include specific contact details when relevant):`,
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
