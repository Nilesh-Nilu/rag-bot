import { INTENT_TYPES } from './config.js';

// =====================================================
// 🚀 FAST INTENT CLASSIFIER (No LLM delay)
// =====================================================

export function classifyIntent(message, sessionState = 'idle') {
  const lower = message.toLowerCase().trim();
  const entities = extractAllEntities(message);
  
  console.log(`🔍 Classifying: "${lower}" | State: ${sessionState} | Phone: ${entities.phone}`);
  
  // If in a specific flow, handle it
  if (sessionState.startsWith('booking_') || sessionState.startsWith('check_') || 
      sessionState.startsWith('cancel_') || sessionState.startsWith('update_')) {
    if (/^(yes|yeah|yep|ok|okay|sure|confirm|done|हां|हाँ|जी|ठीक)$/i.test(lower)) {
      return { intent: INTENT_TYPES.CONFIRM_YES, confidence: 1.0, entities };
    }
    if (/^(no|nope|cancel|stop|नहीं|रद्द|बंद)$/i.test(lower)) {
      return { intent: INTENT_TYPES.CONFIRM_NO, confidence: 1.0, entities };
    }
    return { intent: INTENT_TYPES.PROVIDE_DATA, confidence: 0.9, entities };
  }
  
  // Greeting (exact match only)
  if (/^(hi|hello|hey|hii+|namaste|नमस्ते|hola)[\s!.,]*$/i.test(lower)) {
    return { intent: INTENT_TYPES.GREETING, confidence: 1.0, entities };
  }
  
  // ⚠️ ORDER MATTERS: Check specific intents BEFORE generic "book"
  
  // 1. CHECK booking (check/status/find + booking)
  if (/\b(check|status|find|view|show|see|get|where|मेरी|देखें|देखो)\b/i.test(lower) && 
      /\b(booking|appointment|बुकिंग|अपॉइंटमेंट)\b/i.test(lower)) {
    return { intent: INTENT_TYPES.CHECK_BOOKING, confidence: 0.98, entities };
  }
  
  // 2. CANCEL booking
  if (/\b(cancel|delete|remove|कैंसिल|रद्द|हटाओ)\b/i.test(lower)) {
    return { intent: INTENT_TYPES.CANCEL_BOOKING, confidence: 0.98, entities };
  }
  
  // 3. UPDATE booking
  if (/\b(update|change|reschedule|modify|shift|move|postpone|prepone|बदलो|बदलें|अपडेट)\b/i.test(lower)) {
    return { intent: INTENT_TYPES.UPDATE_BOOKING, confidence: 0.98, entities };
  }
  
  // 4. BOOK new appointment (only if no other action word)
  if (/\b(book|schedule|appointment|meeting|consultation|बुक करो|अपॉइंटमेंट|मीटिंग)\b/i.test(lower) &&
      !/\b(check|status|cancel|update|change|find|view|show)\b/i.test(lower)) {
    return { intent: INTENT_TYPES.BOOK_APPOINTMENT, confidence: 0.95, entities };
  }
  
  // 5. Contact info
  if (/\b(contact|call me|phone|email|talk to|speak to|reach|number|संपर्क|फोन|ईमेल|बात करना)\b/i.test(lower)) {
    return { intent: INTENT_TYPES.CONTACT_INFO, confidence: 0.85, entities };
  }
  
  // 6. If phone number present and no clear intent, might be checking booking
  if (entities.phone && lower.length < 30) {
    return { intent: INTENT_TYPES.CHECK_BOOKING, confidence: 0.7, entities };
  }
  
  // Default: general question
  return { intent: INTENT_TYPES.GENERAL_QUESTION, confidence: 0.6, entities };
}

// Extract all entities from message
export function extractAllEntities(message) {
  const entities = { phone: null, date: null, time: null, name: null, email: null };
  
  // Phone (Indian 10-digit)
  const phoneMatch = message.match(/(?:\+91|91|0)?[\s\-]?([6-9]\d{9})/);
  if (phoneMatch) entities.phone = phoneMatch[1];
  
  // Email
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) entities.email = emailMatch[0];
  
  // Date patterns
  const isoDate = message.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    entities.date = isoDate[1];
  } else {
    const ddmmyyyy = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyy) {
      entities.date = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`;
    } else {
      // "26th", "26 december"
      const dayMatch = message.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i);
      if (dayMatch) {
        const day = parseInt(dayMatch[1]);
        if (day >= 1 && day <= 31) {
          const now = new Date();
          let month = now.getMonth();
          let year = now.getFullYear();
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthMatch = message.toLowerCase().match(new RegExp(months.join('|')));
          if (monthMatch) {
            month = months.findIndex(m => monthMatch[0].startsWith(m));
          } else if (day < now.getDate()) {
            month++;
            if (month > 11) { month = 0; year++; }
          }
          entities.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
  }
  
  // Time patterns
  const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/i);
  if (timeMatch && parseInt(timeMatch[1]) <= 24) {
    let hour = parseInt(timeMatch[1]);
    const mins = timeMatch[2] || '00';
    const period = timeMatch[3]?.toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    entities.time = `${hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour)}:${mins} ${hour >= 12 ? 'PM' : 'AM'}`;
  }
  
  // Name (simple heuristic - capitalized words that aren't common words)
  const skipWords = ['i', 'am', 'my', 'name', 'is', 'the', 'a', 'an', 'to', 'for', 'on', 'at', 'pm', 'am'];
  const words = message.match(/\b[A-Z][a-z]+\b/g);
  if (words) {
    const nameCandidate = words.filter(w => !skipWords.includes(w.toLowerCase())).join(' ');
    if (nameCandidate) entities.name = nameCandidate;
  }
  
  return entities;
}

// Extract phone number from message
export function extractPhoneNumber(message) {
  const cleanMessage = message.replace(/[\s\-\(\)\.]/g, '');
  
  let match = cleanMessage.match(/\+91([6-9]\d{9})/);
  if (match) return match[1];
  
  match = cleanMessage.match(/(?<!\d)91([6-9]\d{9})(?!\d)/);
  if (match) return match[1];
  
  match = cleanMessage.match(/(?<!\d)0([6-9]\d{9})(?!\d)/);
  if (match) return match[1];
  
  match = cleanMessage.match(/(?<!\d)([6-9]\d{9})(?!\d)/);
  if (match) return match[1];
  
  return null;
}

