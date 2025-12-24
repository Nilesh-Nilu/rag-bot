# 🤖 RAG Chatbot SaaS Platform

A complete **Retrieval-Augmented Generation (RAG)** chatbot system with **voice support**, **appointment booking**, and **multilingual capabilities**. Built for businesses to create AI assistants that answer questions based on uploaded PDF documents.

---

## ✨ Key Features

- 📄 **Document-Based AI** - Answers only from uploaded PDFs (no hallucination)
- 🗣️ **Voice Support** - Speech-to-text input & text-to-speech responses
- 🌐 **Multilingual** - English & Hindi support with natural voices
- 📅 **Appointment Booking** - Integrated Cal.com scheduling
- 🏢 **Multi-Tenant SaaS** - Each customer gets isolated data
- 🔌 **Embeddable Widget** - Add chatbot to any website with one script

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/rag-bot.git
cd rag-bot

# Install backend dependencies
npm install

# Install frontend dependencies
cd chatbot-ui && npm install && cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
PORT=3001
```

### 3. Run the Application

```bash
# Terminal 1 - Start backend
npm run server

# Terminal 2 - Start frontend
cd chatbot-ui && npm run dev
```

- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

---

## 📁 Project Structure

```
rag-bot/
├── server.js           # Express API server with booking & contact detection
├── db.js               # SQLite database (bots, documents, bookings)
├── pdf.js              # PDF/DOCX text extraction & chunking
├── embedding.js        # Text vectorization (TF-IDF)
├── rag.js              # LLM answer generation with natural language
├── package.json        # Backend dependencies
├── .env                # Environment configuration
├── rag.db              # SQLite database file
├── uploads/            # Temporary file upload storage
├── docs/               # Sample documents
├── widget/             # Embeddable chat widget
│   ├── chatbot.js      # Self-contained widget script
│   └── embed-example.html
└── chatbot-ui/         # React admin dashboard
    ├── src/
    │   ├── App.jsx     # Main React component with voice & booking
    │   ├── App.css     # Dark theme styling
    │   └── main.jsx    # React entry point
    ├── index.html      # Cal.com embed script included
    └── package.json
```

---

## 🔧 Backend API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bots` | Create a new bot |
| `GET` | `/api/bots/:botId` | Get bot info & document count |
| `POST` | `/api/bots/:botId/upload` | Upload PDF/DOCX file |
| `POST` | `/api/bots/:botId/chat` | Send message, get AI response |
| `GET` | `/api/booking-url` | Get Cal.com booking URL |
| `GET` | `/api/health` | Health check |

### Chat Request

```bash
POST /api/bots/:botId/chat
Content-Type: application/json

{
  "message": "What services do you offer?",
  "language": "en"  # or "hi" for Hindi
}
```

### Response with Booking

When user asks to talk/contact/book:

```json
{
  "answer": "Here's how you can reach us:\n📞 Phone: +91-9110176498\n📧 Email: contactus@example.com",
  "isBookingResponse": true,
  "bookingUrl": "https://cal.com/your-link"
}
```

---

## 📊 Database Schema

### Tables

```sql
-- Bots (multi-tenant)
CREATE TABLE bots (
  id TEXT PRIMARY KEY,
  name TEXT,
  website TEXT,
  created_at DATETIME
);

-- Document chunks
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  bot_id TEXT,
  chunk_text TEXT,
  term_freq TEXT,
  source_file TEXT,
  created_at DATETIME
);

-- Appointment bookings
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  bot_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME,
  updated_at DATETIME
);
```

---

## 🗣️ Voice & Language Features

### Supported Languages

| Language | Code | Voice | Speech Recognition |
|----------|------|-------|-------------------|
| English | `en` | Samantha, Microsoft Zira, Google US | `en-IN` |
| Hindi | `hi` | Lekha, Microsoft Hemant | `hi-IN` |

### Natural Conversation Style

The chatbot uses warm, human-like responses:
- Uses contractions ("I'm", "don't", "it's")
- Adds natural phrases ("Well, let me see...", "That's a great question!")
- Feminine grammar for Hindi ("सकती हूं", "करूंगी")

---

## 📅 Booking Integration

### Cal.com Setup

The chatbot integrates with Cal.com for appointment scheduling. Update in `server.js`:

```javascript
const BOOKING_URL = "https://cal.com/your-username/meeting-type";
```

### Booking Triggers

The chatbot shows booking options when users say:
- "book an appointment"
- "schedule a meeting"
- "I want to talk to someone"
- "contact the team"
- "बात करना चाहता हूं" (Hindi)

### Response Includes

1. **Direct Contact Info** - Phone numbers & email
2. **Booking Button** - Opens Cal.com calendar inline

---

## 🔄 How RAG Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Upload PDF │ ──▶ │  Extract &  │ ──▶ │  Store in   │
│  or DOCX    │     │  Chunk Text │     │  SQLite DB  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Return    │ ◀── │  Generate   │ ◀── │   Search    │
│   Answer    │     │  via LLM    │     │  Relevant   │
└─────────────┘     └─────────────┘     │   Chunks    │
                                        └─────────────┘
```

1. **Upload** - PDF/DOCX extracted to text
2. **Chunk** - Split into ~800 char segments with overlap
3. **Index** - Convert to TF-IDF vectors, store in SQLite
4. **Query** - User question → find similar chunks
5. **Generate** - LLM answers using only retrieved context

---

## 🔌 Embed Widget

Add the chatbot to any website:

```html
<script>
  window.ChatbotConfig = {
    apiUrl: 'https://your-api.com',
    botId: 'your-bot-id-here',
    theme: 'dark',
    position: 'right'
  };
</script>
<script src="https://your-api.com/widget/chatbot.js"></script>
```

---

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |

### Key Settings

| Setting | Location | Default | Description |
|---------|----------|---------|-------------|
| Chunk Size | `pdf.js` | 800 chars | Text chunk size |
| Chunk Overlap | `pdf.js` | 100 chars | Overlap between chunks |
| Search Limit | `db.js` | 5 | Chunks to retrieve |
| Max File Size | `server.js` | 10MB | Upload limit |
| LLM Model | `rag.js` | llama3.1:8b | Ollama model |
| Booking URL | `server.js` | Cal.com link | Scheduling calendar |

---

## 📝 Supported File Types

- ✅ PDF (text-based)
- ✅ DOCX (Word documents)
- ❌ Scanned PDFs (need OCR)
- ❌ Images

---

## 🔒 Security

1. **Bot Isolation** - Each bot only sees its own documents
2. **CORS** - Configure allowed origins for production
3. **File Validation** - Only PDF/DOCX accepted
4. **No Data Leakage** - LLM answers only from uploaded documents

---

## 🚀 Production Deployment

1. Update `API_URL` in frontend
2. Configure CORS origins in `server.js`
3. Set up SSL/HTTPS
4. Use process manager (PM2)
5. Configure Cal.com webhook for booking notifications

---

## 📄 License

MIT License - Free for commercial and personal use.
