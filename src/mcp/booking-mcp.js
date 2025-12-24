// MCP Server for Booking Management

import { 
  createBooking, getBookingsByPhone, 
  cancelBookingByPhone, updateBooking 
} from '../../db.js';

// Session store
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      state: 'idle',
      data: {},
      context: [],
      lastPhone: null,      // Remember last phone used
      lastBooking: null,    // Remember last booking checked
      lastActivity: Date.now()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  return session;
}

// Clean old sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// =====================================================
// 🚀 FAST INTENT CLASSIFIER (No API calls needed)
// =====================================================
function classifyIntent(message) {
  const lower = message.toLowerCase().trim();
  const entities = extractEntities(message);
  
  // Greeting
  if (/^(hi|hello|hey|hii+|namaste|नमस्ते)[\s!.,]*$/i.test(lower)) {
    return { intent: 'GREETING', entities };
  }
  
  // Confirmation
  if (/^(yes|yeah|yep|ok|okay|sure|confirm|done|हां|हाँ|जी|ठीक)$/i.test(lower)) {
    return { intent: 'CONFIRM_YES', entities };
  }
  if (/^(no|nope|cancel|stop|नहीं|रद्द)$/i.test(lower)) {
    return { intent: 'CONFIRM_NO', entities };
  }
  
  // Check booking
  if (/\b(check|status|find|view|show|see|where|मेरी|देखें)\b/i.test(lower) && 
      /\b(booking|appointment|बुकिंग)\b/i.test(lower)) {
    return { intent: 'CHECK_BOOKING', entities };
  }
  
  // Cancel booking
  if (/\b(cancel|delete|remove|कैंसिल|रद्द)\b/i.test(lower)) {
    return { intent: 'CANCEL_BOOKING', entities };
  }
  
  // Update booking - also detect "update the date/time to X"
  if (/\b(update|change|reschedule|modify|shift|move|बदलें|अपडेट)\b/i.test(lower) ||
      /\b(date|time|तारीख|समय)\s*(to|ko|को)\b/i.test(lower)) {
    return { intent: 'UPDATE_BOOKING', entities };
  }
  
  // Book appointment
  if (/\b(book|schedule|appointment|meeting|consultation|बुक|मीटिंग)\b/i.test(lower) &&
      !/\b(check|status|cancel|update)\b/i.test(lower)) {
    return { intent: 'BOOK_APPOINTMENT', entities };
  }
  
  // Contact info
  if (/\b(contact|call|phone|email|talk|speak|reach|संपर्क|फोन)\b/i.test(lower)) {
    return { intent: 'CONTACT_INFO', entities };
  }
  
  // Just a phone number - assume checking booking
  if (entities.phone && lower.length < 20) {
    return { intent: 'CHECK_BOOKING', entities };
  }
  
  // Providing data (for multi-turn flow)
  return { intent: 'PROVIDE_DATA', entities };
}

// Extract entities from message
function extractEntities(message) {
  const entities = { phone: null, date: null, time: null, name: null };
  
  // Phone (Indian 10-digit)
  const phoneMatch = message.match(/(?:\+91|91|0)?[\s\-]?([6-9]\d{9})/);
  if (phoneMatch) entities.phone = phoneMatch[1];
  
  // Date extraction - improved
  const isoDate = message.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    entities.date = isoDate[1];
  } else if (/tomorrow|कल/i.test(message)) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    entities.date = d.toISOString().split('T')[0];
  } else {
    // Match "28", "28th", "28 December", "28th dec"
    const dayMatch = message.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (dayMatch) {
      const day = parseInt(dayMatch[1]);
      if (day >= 1 && day <= 31) {
        const now = new Date();
        let month = now.getMonth();
        let year = now.getFullYear();
        
        // Check for month names
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const fullMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const lower = message.toLowerCase();
        
        for (let i = 0; i < 12; i++) {
          if (lower.includes(fullMonths[i]) || lower.includes(months[i])) {
            month = i;
            break;
          }
        }
        
        // If day passed this month and no month specified, use next month
        if (day < now.getDate() && !months.some(m => lower.includes(m)) && !fullMonths.some(m => lower.includes(m))) {
          month++;
          if (month > 11) { month = 0; year++; }
        }
        
        entities.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  
  // Time extraction - improved to handle "2 AM", "10:30 PM", etc.
  const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const mins = timeMatch[2] || '00';
    const period = timeMatch[3].toUpperCase();
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const displayPeriod = hour >= 12 ? 'PM' : 'AM';
    entities.time = `${displayHour}:${mins} ${displayPeriod}`;
  } else {
    // Try without AM/PM - assume business hours
    const simpleTime = message.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
    if (simpleTime && parseInt(simpleTime[1]) <= 12) {
      const hour = parseInt(simpleTime[1]);
      const mins = simpleTime[2] || '00';
      // Assume PM for 1-6, AM for 7-12
      const period = (hour >= 7 && hour <= 11) ? 'AM' : 'PM';
      entities.time = `${hour}:${mins} ${period}`;
    }
  }
  
  // Name (capitalized words)
  const words = message.match(/\b[A-Z][a-z]+\b/g);
  if (words) {
    const skip = ['i', 'am', 'my', 'name', 'is', 'the', 'to', 'pm', 'am'];
    const name = words.filter(w => !skip.includes(w.toLowerCase())).join(' ');
    if (name) entities.name = name;
  }
  
  return entities;
}

// =====================================================
// 🔧 MCP TOOLS
// =====================================================
const TOOLS = {
  async startBooking(session, language) {
    session.state = 'booking_name';
    session.data = {};
    return { response: language === 'hi' ? '👤 आपका नाम क्या है?' : '👤 What is your name?', action: 'ASK_NAME' };
  },

  async collectName(session, name, language) {
    session.data.fullName = name;
    session.state = 'booking_phone';
    return { 
      response: language === 'hi' ? `धन्यवाद ${name}! 📱 मोबाइल नंबर?` : `Thanks ${name}! 📱 Mobile number?`, 
      action: 'ASK_PHONE' 
    };
  },

  async collectPhone(session, phone, language) {
    const clean = phone?.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length !== 10 || !/^[6-9]/.test(clean)) {
      return { response: language === 'hi' ? '❌ सही 10 अंकों का नंबर दें।' : '❌ Enter valid 10-digit number.', action: 'RETRY' };
    }
    session.data.phone = clean;
    session.state = 'booking_date';
    return { response: language === 'hi' ? '📅 तारीख? (26, tomorrow)' : '📅 Date? (26, tomorrow)', action: 'ASK_DATE' };
  },

  async collectDate(session, date, language) {
    if (!date) return { response: language === 'hi' ? '❌ सही तारीख बताएं।' : '❌ Enter valid date.', action: 'RETRY' };
    session.data.preferredDate = date;
    session.state = 'booking_time';
    return { response: language === 'hi' ? '⏰ समय? (10am, 3pm)' : '⏰ Time? (10am, 3pm)', action: 'ASK_TIME' };
  },

  async collectTime(session, time, language) {
    if (!time) return { response: language === 'hi' ? '❌ सही समय बताएं।' : '❌ Enter valid time.', action: 'RETRY' };
    session.data.preferredTime = time;
    session.data.service = 'Project Discussion';
    session.data.email = 'via-chat@booking.com';
    session.state = 'booking_confirm';
    
    const { fullName, phone, preferredDate, preferredTime } = session.data;
    return { 
      response: `📋 Booking:\n👤 ${fullName}\n📱 ${phone}\n📅 ${preferredDate}\n⏰ ${preferredTime}\n\n✅ Confirm? (yes/no)`,
      action: 'CONFIRM' 
    };
  },

  async confirm(session, botId, yes, language) {
    if (yes) {
      const id = await createBooking(botId, session.data);
      session.state = 'idle'; session.data = {};
      return { response: language === 'hi' ? `✅ बुकिंग कन्फर्म! ID: ${id.slice(0,8)}` : `✅ Booking confirmed!`, action: 'CREATED', bookingId: id };
    }
    session.state = 'idle'; session.data = {};
    return { response: language === 'hi' ? '❌ बुकिंग रद्द।' : '❌ Cancelled.', action: 'CANCELLED' };
  },

  async checkBooking(phone, language, session) {
    if (!phone) return { response: language === 'hi' ? '📱 मोबाइल नंबर?' : '📱 Mobile number?', action: 'ASK_PHONE', needsPhone: true };
    const bookings = await getBookingsByPhone(phone);
    if (!bookings.length) return { response: language === 'hi' ? `❌ ${phone} से कोई बुकिंग नहीं।` : `❌ No booking for ${phone}.`, action: 'NOT_FOUND' };
    const b = bookings[0];
    // Remember phone and booking for future updates
    if (session) {
      session.lastPhone = phone;
      session.lastBooking = b;
    }
    return { response: `✅ Booking:\n👤 ${b.full_name}\n📅 ${b.preferred_date}\n⏰ ${b.preferred_time}\n📊 ${b.status}`, action: 'FOUND', booking: b };
  },

  async cancelBooking(phone, language) {
    if (!phone) return { response: language === 'hi' ? '📱 कैंसिल के लिए नंबर?' : '📱 Number to cancel?', action: 'ASK_PHONE', needsPhone: true };
    const count = await cancelBookingByPhone(phone);
    return { response: count > 0 ? (language === 'hi' ? '✅ कैंसिल हो गई।' : '✅ Cancelled.') : (language === 'hi' ? '❌ नहीं मिली।' : '❌ Not found.'), action: count > 0 ? 'CANCELLED' : 'NOT_FOUND' };
  },

  async updateBookingAction(phone, date, time, language, session) {
    // Use last known phone if not provided
    const usePhone = phone || session?.lastPhone;
    
    if (!usePhone) {
      session.state = 'update_phone';
      return { response: language === 'hi' ? '📱 अपडेट के लिए नंबर?' : '📱 Number to update?', action: 'ASK_PHONE' };
    }
    
    const bookings = await getBookingsByPhone(usePhone);
    if (!bookings.length) return { response: language === 'hi' ? '❌ नहीं मिली।' : '❌ Not found.', action: 'NOT_FOUND' };
    
    // If no date/time provided, ask for it
    if (!date && !time) {
      session.updatePhone = usePhone;
      session.state = 'update_details';
      return { response: language === 'hi' ? '📅 नई तारीख/समय?' : '📅 New date/time?', action: 'ASK_DETAILS' };
    }
    
    const updates = {};
    if (date) updates.preferredDate = date;
    if (time) updates.preferredTime = time;
    await updateBooking(bookings[0].id, updates);
    
    // Get updated booking
    const updated = (await getBookingsByPhone(usePhone))[0];
    return { 
      response: language === 'hi' 
        ? `✅ बुकिंग अपडेट!\n📅 ${updated.preferred_date}\n⏰ ${updated.preferred_time}` 
        : `✅ Booking updated!\n📅 ${updated.preferred_date}\n⏰ ${updated.preferred_time}`, 
      action: 'UPDATED',
      booking: updated
    };
  }
};

// =====================================================
// 🧠 MAIN MCP HANDLER
// =====================================================
export async function handleMCPRequest(botId, message, sessionId, language = 'en') {
  const session = getSession(sessionId);
  const { intent, entities } = classifyIntent(message);
  
  console.log(`🧠 MCP [${sessionId}] State: ${session.state} | Intent: ${intent} | Phone: ${entities.phone}`);
  
  let result;
  
  // Handle based on current state
  switch (session.state) {
    case 'booking_name':
      result = await TOOLS.collectName(session, entities.name || message.trim(), language);
      break;
    case 'booking_phone':
      result = await TOOLS.collectPhone(session, entities.phone || message, language);
      break;
    case 'booking_date':
      result = await TOOLS.collectDate(session, entities.date, language);
      break;
    case 'booking_time':
      result = await TOOLS.collectTime(session, entities.time, language);
      break;
    case 'booking_confirm':
      result = await TOOLS.confirm(session, botId, intent === 'CONFIRM_YES', language);
      break;
    case 'check_phone':
      result = await TOOLS.checkBooking(entities.phone || message.replace(/\D/g, '').slice(-10), language, session);
      session.state = 'idle';
      break;
    case 'cancel_phone':
      result = await TOOLS.cancelBooking(entities.phone || message.replace(/\D/g, '').slice(-10), language);
      session.state = 'idle';
      break;
    case 'update_phone':
      session.updatePhone = entities.phone || session.lastPhone || message.replace(/\D/g, '').slice(-10);
      session.state = 'update_details';
      result = { response: language === 'hi' ? '📅 नई तारीख/समय?' : '📅 New date/time?', action: 'ASK_DETAILS' };
      break;
    case 'update_details':
      result = await TOOLS.updateBookingAction(session.updatePhone || session.lastPhone, entities.date, entities.time, language, session);
      if (result.action !== 'ASK_DETAILS') session.state = 'idle';
      break;
    default:
      // Handle new intents
      switch (intent) {
        case 'BOOK_APPOINTMENT':
          result = await TOOLS.startBooking(session, language);
          break;
        case 'CHECK_BOOKING':
          result = await TOOLS.checkBooking(entities.phone, language, session);
          if (result.needsPhone) session.state = 'check_phone';
          break;
        case 'CANCEL_BOOKING':
          result = await TOOLS.cancelBooking(entities.phone, language);
          if (result.needsPhone) session.state = 'cancel_phone';
          break;
        case 'UPDATE_BOOKING':
          result = await TOOLS.updateBookingAction(entities.phone, entities.date, entities.time, language, session);
          break;
        case 'CONTACT_INFO':
          result = { response: '📞 +91-9110176498 / +91-8800869961\n📧 contactus@murmusoftwareinfotech.com', action: 'CONTACT' };
          break;
        case 'GREETING':
          result = { response: language === 'hi' ? '👋 नमस्ते! कैसे मदद करूं?\n• book appointment\n• check booking' : '👋 Hello! How can I help?\n• book appointment\n• check booking', action: 'GREETING' };
          break;
        default:
          // Let RAG handle it
          result = null;
      }
  }
  
  return result;
}

export { getSession, sessions };
