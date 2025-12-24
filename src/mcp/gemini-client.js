// Gemini API Client for MCP Server
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config.js';

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function callGemini(prompt, systemInstruction = '') {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 500,
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Gemini call failed:', error.message);
    return null;
  }
}

// Classify user intent using Gemini
export async function classifyIntentWithGemini(message, conversationContext = '') {
  const systemPrompt = `You are an intent classifier for a business chatbot. Analyze the user message and respond with ONLY valid JSON.

AVAILABLE INTENTS:
- BOOK_APPOINTMENT: User wants to schedule/book a meeting, appointment, call
- CHECK_BOOKING: User wants to check/view/find their existing booking status
- CANCEL_BOOKING: User wants to cancel their booking
- UPDATE_BOOKING: User wants to change/reschedule date or time
- CONTACT_INFO: User wants phone number, email, or to talk to someone
- GENERAL_QUESTION: User asking about services, company info, or other questions
- GREETING: Simple hello, hi, namaste
- CONFIRM_YES: User confirming/agreeing (yes, ok, sure, हां)
- CONFIRM_NO: User declining/canceling (no, cancel, नहीं)
- PROVIDE_DATA: User providing requested information (name, phone, date, time)

ENTITY EXTRACTION:
- phone: 10-digit Indian mobile number (extract digits only, handle +91/91/0 prefix)
- date: Convert to YYYY-MM-DD format. Handle "26", "26th", "tomorrow", "26 December"
- time: Convert to "HH:MM AM/PM" format. Handle "10am", "3 PM", "15:00"
- name: Person's name if mentioned

Current conversation context: ${conversationContext || 'None'}`;

  const prompt = `User message: "${message}"

Respond with ONLY this JSON (no markdown, no explanation):
{"intent":"INTENT_NAME","confidence":0.95,"entities":{"phone":null,"date":null,"time":null,"name":null},"response_hint":"brief suggestion for response"}`;

  const result = await callGemini(prompt, systemPrompt);
  
  if (!result) {
    return { intent: 'GENERAL_QUESTION', confidence: 0.5, entities: {}, response_hint: 'fallback' };
  }

  try {
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('🧠 Gemini Intent:', parsed);
      return parsed;
    }
  } catch (e) {
    console.error('JSON parse error:', e.message, 'Raw:', result);
  }

  return { intent: 'GENERAL_QUESTION', confidence: 0.5, entities: {}, response_hint: 'parse_failed' };
}

// Generate conversational response using Gemini
export async function generateBookingResponse(context, language = 'en') {
  const systemPrompt = `You are a friendly booking assistant for Murmu Software Infotech.
- Be brief and direct (1-2 sentences max)
- Use emojis sparingly
- Language: ${language === 'hi' ? 'Hindi' : 'English'}
- Never make up information
- If asking for data, be specific about what you need`;

  const result = await callGemini(context, systemPrompt);
  return result || (language === 'hi' ? 'कृपया दोबारा कोशिश करें।' : 'Please try again.');
}

