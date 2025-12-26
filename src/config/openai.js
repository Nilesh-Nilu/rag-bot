import OpenAI from "openai";

let openaiClient = null;

export function initializeOpenAI() {
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return true;
  }
  return false;
}

export function getOpenAI() {
  return openaiClient;
}

export function isOpenAIConfigured() {
  return !!openaiClient;
}

export default { initializeOpenAI, getOpenAI, isOpenAIConfigured };

