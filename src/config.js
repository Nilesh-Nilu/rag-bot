import { config } from "dotenv";
config();

// API Configuration
export const API_URL = process.env.API_URL || "https://api.naga.ac";
export const TOKEN = process.env.API_TOKEN || "ng-yV4Oq2QZZ5MFNC4ggAQ2e0X1wuaO0NkG";
export const DEFAULT_BOT_ID = process.env.DEFAULT_BOT_ID || 'default-bot';
export const PORT = process.env.PORT || 3001;

// Gemini API (for MCP Server)
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBs0xAPFqGzPR6IgEs7vJmjpznHf1hwOEY';
export const GEMINI_MODEL = 'gemini-1.5-flash';

// Intent types for MCP
export const INTENT_TYPES = {
  BOOK_APPOINTMENT: 'book_appointment',
  CHECK_BOOKING: 'check_booking',
  CANCEL_BOOKING: 'cancel_booking',
  UPDATE_BOOKING: 'update_booking',
  CONTACT_INFO: 'contact_info',
  GENERAL_QUESTION: 'general_question',
  GREETING: 'greeting',
  CONFIRM_YES: 'confirm_yes',
  CONFIRM_NO: 'confirm_no',
  PROVIDE_DATA: 'provide_data',
  UNKNOWN: 'unknown'
};

