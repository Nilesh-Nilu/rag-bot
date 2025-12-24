# 🎨 RAG Chatbot UI

A modern React admin dashboard for the RAG Chatbot with **voice support**, **multilingual chat**, and **integrated appointment booking**. Built with React 19 and Vite.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Bot Management** | One-click chatbot creation with unique Bot ID |
| 📤 **Document Upload** | Drag & drop PDF/DOCX with processing status |
| 💬 **Chat Interface** | Real-time AI responses with typing indicators |
| 🗣️ **Voice Input** | Speech recognition (mic button) |
| 🔊 **Voice Output** | Natural text-to-speech responses |
| 🌐 **Multilingual** | English & Hindi support |
| 📅 **Booking Calendar** | Inline Cal.com scheduling |
| 🔗 **Embed Generator** | Copy-paste widget code |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Backend API running on `http://localhost:3001`

### Installation

```bash
cd chatbot-ui
npm install
npm run dev
```

Open http://localhost:5173

---

## 📁 Project Structure

```
chatbot-ui/
├── src/
│   ├── App.jsx        # Main component (chat, voice, booking)
│   ├── App.css        # Dark theme styles
│   ├── main.jsx       # React entry point
│   └── index.css      # Global styles
├── public/
│   └── vite.svg       # Favicon
├── index.html         # Cal.com embed script
├── package.json       # Dependencies
└── vite.config.js     # Vite configuration
```

---

## 🖥️ UI Screens

### 1. Onboarding
- Shown when no Bot ID exists
- "Create Your Chatbot" button

### 2. Dashboard
- **Sidebar** - Navigation tabs
- **Main Content** - Chat, Upload, or Embed view

### 3. Tabs

| Tab | Icon | Features |
|-----|------|----------|
| **Chat** | 💬 | Voice input, TTS output, language selector, booking |
| **Upload PDF** | 📤 | Drag & drop, file validation, progress status |
| **Embed Code** | 🔗 | Widget code, theme/position options |

---

## 🗣️ Voice Features

### Speech Recognition (Input)
- Click 🎤 mic button to speak
- Auto-sends message after transcription
- Supports English & Hindi

### Text-to-Speech (Output)
- Automatic voice response when enabled
- Click 🔊 on any message to replay
- Natural human-like voices

### Voice Controls

| Button | Function |
|--------|----------|
| 🎤 | Start/stop listening |
| 🔊 | Toggle auto voice response |
| 🔇 | Mute voice output |
| ⏹️ | Stop current speech |

### Voice Settings

```javascript
// Voice selection priority:
1. User-selected voice (dropdown)
2. Premium voices (Samantha, Google, etc.)
3. System default

// Speech parameters:
- Rate: 0.85-0.9 (natural pace)
- Pitch: 1.0-1.05 (pleasant tone)
- Delay: 300ms before speaking
```

---

## 🌐 Language Support

### Available Languages

| Language | Flag | Voice Code | Speech Code |
|----------|------|------------|-------------|
| English | 🇬🇧 | `en-uk` | `en-IN` |
| Hindi | 🇮🇳 | `hi` | `hi-IN` |

### Switching Languages
1. Use dropdown in chat header
2. Voice output adapts automatically
3. Speech recognition switches language
4. LLM responds in selected language

---

## 📅 Booking Integration

### How It Works

1. User asks to "talk to someone" or "book appointment"
2. Chatbot shows contact info + booking button
3. User clicks "📆 View Calendar"
4. Cal.com calendar appears inline in chat
5. User selects time slot
6. Booking confirmed without leaving chat

### Booking Triggers
- "book an appointment"
- "schedule a meeting"
- "I want to talk to someone"
- "contact the team"
- "reach out"

### Cal.com Configuration

In `index.html`:
```javascript
Cal("init", "project-discussion", { origin: "https://cal.com" });
```

In `App.jsx`:
```javascript
const CAL_LINK = "nilu-tudu-l68h0q/project-discussion";
```

---

## 🔧 Configuration

### API URL
Edit `src/App.jsx`:

```javascript
const API_URL = "http://localhost:3001";  // Backend URL
const CAL_LINK = "your-username/meeting-type";  // Cal.com link
```

### Voice Preferences
The app auto-selects best available voice. Priority order:

**English:**
1. Samantha (macOS)
2. Microsoft Zira (Windows)
3. Google US English
4. Any English voice

**Hindi:**
1. Microsoft Hemant
2. Lekha
3. Any Hindi voice

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (http://localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Vite 5 | Build tool & dev server |
| Web Speech API | Voice recognition & TTS |
| Cal.com Embed | Appointment scheduling |
| CSS Variables | Dark theme styling |

---

## 🎨 Styling

### Theme Colors (CSS Variables)

```css
:root {
  --bg-primary: #09090b;      /* Main background */
  --bg-secondary: #18181b;    /* Sidebar */
  --bg-tertiary: #27272a;     /* Cards */
  --accent: #6366f1;          /* Primary accent (indigo) */
  --user-bubble: #3b82f6;     /* User message */
  --assistant-bubble: #27272a; /* Bot message */
  --success: #22c55e;         /* Green */
  --error: #ef4444;           /* Red */
}
```

### Key CSS Classes

| Class | Component |
|-------|-----------|
| `.chat-panel` | Main chat container |
| `.message.user` | User message bubble |
| `.message.assistant` | Bot message bubble |
| `.booking-btn` | Green booking button |
| `.mic-btn.listening` | Active recording state |
| `.cal-inline-embed` | Cal.com calendar container |

---

## 📡 API Integration

### Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/bots` | Create bot |
| `GET` | `/api/bots/:botId` | Get bot info |
| `POST` | `/api/bots/:botId/upload` | Upload document |
| `POST` | `/api/bots/:botId/chat` | Send message |

### Chat Request

```javascript
fetch(`${API_URL}/api/bots/${botId}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Hello",
    language: "en"  // or "hi"
  })
});
```

### Chat Response

```json
{
  "answer": "Hi there! How can I help you today?",
  "sources": 3,
  "isBookingResponse": false
}
```

### Booking Response

```json
{
  "answer": "Here's how to reach us:\n📞 +91-9110176498\n📧 email@example.com",
  "isBookingResponse": true,
  "bookingUrl": "https://cal.com/..."
}
```

---

## 🔄 State Management

### Key States

| State | Type | Purpose |
|-------|------|---------|
| `botId` | string | Current bot identifier |
| `messages` | array | Chat history |
| `language` | string | Selected language (`en`/`hi`) |
| `isListening` | boolean | Voice input active |
| `isSpeaking` | boolean | TTS playing |
| `voiceEnabled` | boolean | Auto-speak responses |
| `showInlineBooking` | boolean | Calendar visible |

---

## 📱 Responsive Design

- **Desktop** - Full sidebar + chat view
- **Mobile** - Sidebar hidden, full-width chat
- Breakpoint: `768px`

---

## 🐛 Troubleshooting

### Voice Not Working
1. Check browser permissions for microphone
2. Ensure HTTPS (required for speech API)
3. Try different browser (Chrome works best)

### No Hindi Voice
1. Install Hindi language pack in OS settings
2. macOS: System Preferences → Keyboard → Text → Input Sources
3. Windows: Settings → Time & Language → Speech

### Cal.com Not Loading
1. Check Cal.com link in `index.html`
2. Verify `CAL_LINK` in `App.jsx`
3. Check browser console for errors

---

## 🔗 Related

- [Backend Documentation](../README.md) - API server & RAG pipeline
- [Widget Documentation](../widget/) - Embeddable chat widget
- [Cal.com Embed Docs](https://cal.com/docs/core-features/embed) - Booking integration
