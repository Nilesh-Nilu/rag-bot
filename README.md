# 🤖 RAG Chatbot SaaS Platform

A complete **Retrieval-Augmented Generation (RAG)** chatbot system that answers questions based **only** on uploaded PDF documents. Built with Node.js, SQLite, React, and Ollama (Llama 3.1).

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Nilesh-Nilu/rag-bot.git
cd rag-bot

# Install backend dependencies
npm install

# Install frontend dependencies
cd chatbot-ui && npm install && cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
API_URL=http://213.210.37.56:8080
API_TOKEN=your_ollama_bearer_token
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
├── server.js           # Express API server (main backend)
├── db.js               # SQLite database operations
├── pdf.js              # PDF text extraction & chunking
├── embedding.js        # Text vectorization (TF-IDF)
├── rag.js              # LLM answer generation via Ollama
├── package.json        # Backend dependencies
├── .env                # API credentials (Ollama server)
├── rag.db              # SQLite database file
├── uploads/            # Temporary PDF upload storage
├── widget/             # Embeddable chat widget
│   ├── chatbot.js      # Self-contained widget script
│   └── embed-example.html
└── chatbot-ui/         # React admin dashboard
    ├── src/
    │   ├── App.jsx     # Main React component
    │   └── App.css     # Styling
    └── package.json
```

---

## 🔄 How It Works

### High-Level Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Upload PDF │ ──▶ │  Extract &  │ ──▶ │  Store in   │
│             │     │  Chunk Text │     │  SQLite DB  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Return    │ ◀── │  Generate   │ ◀── │   Search    │
│   Answer    │     │  via LLM    │     │  Relevant   │
└─────────────┘     └─────────────┘     │   Chunks    │
                                        └─────────────┘
                                              ▲
                                              │
                                    ┌─────────────┐
                                    │ User Query  │
                                    └─────────────┘
```

---

## 🔧 Backend Components

### 1. `server.js` - Express API Server

The main entry point that handles all HTTP requests.

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bots` | Create a new bot (multi-tenant) |
| `GET` | `/api/bots/:botId` | Get bot info & document count |
| `POST` | `/api/bots/:botId/upload` | Upload & process PDF |
| `POST` | `/api/bots/:botId/chat` | Send message, get AI response |
| `GET` | `/api/health` | Health check |

**Key Features:**
- CORS enabled for cross-origin requests
- Multer for file upload handling (10MB limit)
- Serves static widget files from `/widget`

---

### 2. `db.js` - SQLite Database

Multi-tenant database schema for SaaS support.

**Tables:**

```sql
-- Each customer/website gets a bot
CREATE TABLE bots (
  id TEXT PRIMARY KEY,          -- UUID
  name TEXT,
  website TEXT,
  created_at DATETIME
);

-- Document chunks linked to bots
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  bot_id TEXT,                  -- Foreign key to bots
  chunk_text TEXT,              -- The actual text chunk
  term_freq TEXT,               -- JSON: word frequency map
  source_file TEXT,             -- Original filename
  created_at DATETIME
);
```

**Functions:**
- `createBot(name, website)` → Returns new bot UUID
- `insertChunk(botId, text, termFreq, filename)` → Store chunk
- `searchSimilar(botId, queryTermFreq, limit)` → Find relevant chunks
- `clearBotDocuments(botId)` → Delete all docs for a bot

---

### 3. `pdf.js` - PDF Processing

**Text Extraction:**
```javascript
import pdfParse from "pdf-parse";

export async function extractPdfText(path) {
  const buffer = fs.readFileSync(path);
  const data = await pdfParse(buffer);
  return data.text;  // Plain text from PDF
}
```

**Chunking Strategy:**
```javascript
export function chunkText(text, chunkSize = 800, overlap = 100) {
  // Split text into overlapping chunks
  // - chunkSize: ~800 characters per chunk
  // - overlap: 100 chars overlap between chunks
  // This ensures context isn't lost at boundaries
}
```

**Why Chunking?**
- LLMs have context limits
- Smaller chunks = more precise retrieval
- Overlap prevents losing context at boundaries

---

### 4. `embedding.js` - Text Vectorization

Uses **TF-IDF** (Term Frequency) for text similarity since no embedding model is available on the server.

```javascript
// Convert text to word frequency map
export function getTextVector(text) {
  const tokens = tokenize(text);  // lowercase, remove punctuation
  return termFrequency(tokens);   // { word: count, ... }
}

// Calculate similarity between two texts
export function cosineSimilarity(vec1, vec2) {
  // Cosine similarity formula
  // Returns 0-1 (1 = identical)
}
```

**How Search Works:**
1. User query → Convert to term frequency vector
2. Compare with all stored chunk vectors
3. Sort by similarity score
4. Return top 5 most relevant chunks

---

### 5. `rag.js` - Answer Generation

Sends context + question to Ollama LLM.

```javascript
export async function generateAnswer(question, context) {
  const prompt = `
You are a document-based AI assistant.

RULES:
1. ONLY answer using the provided context
2. If info not in context, say "I don't have that information"
3. Do NOT use external knowledge

CONTEXT:
${context}

QUESTION: ${question}
`;

  const response = await axios.post(`${API_URL}/ollama/api/generate`, {
    model: "llama3.1:8b",
    prompt,
    stream: false
  }, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });

  return response.data.response;
}
```

---

## 🎨 Frontend Components

### 1. `chatbot-ui/` - React Admin Dashboard

A full admin interface for managing the chatbot.

**Features:**
- 🔐 Bot creation & management
- 📤 Drag & drop PDF upload
- 💬 Chat interface with typing indicators
- 🔗 Embed code generator

**Tabs:**
1. **Chat** - Test the chatbot
2. **Upload PDF** - Add documents to knowledge base
3. **Embed Code** - Get code to add widget to any website

---

### 2. `widget/chatbot.js` - Embeddable Widget

A self-contained JavaScript file that creates a chat widget on any website.

**Features:**
- 💬 Floating chat bubble (bottom-right)
- 📤 Built-in PDF upload
- 🌙 Dark/Light theme support
- 📱 Mobile responsive

**How to Embed:**
```html
<script>
  window.ChatbotConfig = {
    apiUrl: 'https://your-api.com',
    botId: 'your-bot-id-here',
    theme: 'dark',      // 'dark' or 'light'
    position: 'right'   // 'right' or 'left'
  };
</script>
<script src="https://your-api.com/widget/chatbot.js"></script>
```

---

## 🔄 Complete Request Flow

### PDF Upload Flow

```
1. User drops PDF in upload zone
         │
         ▼
2. Frontend sends POST /api/bots/:botId/upload
   with FormData containing PDF file
         │
         ▼
3. Multer saves file to ./uploads/
         │
         ▼
4. pdf.js extracts text using pdf-parse
         │
         ▼
5. Text split into ~800 char chunks with overlap
         │
         ▼
6. Each chunk → getTextVector() → term frequency map
         │
         ▼
7. Chunks + vectors stored in SQLite (documents table)
         │
         ▼
8. Temp file deleted, success response sent
```

### Chat Query Flow

```
1. User types question in chat
         │
         ▼
2. Frontend sends POST /api/bots/:botId/chat
   { message: "What are the operating hours?" }
         │
         ▼
3. Query → getTextVector() → term frequency map
         │
         ▼
4. searchSimilar() compares query vector
   with all document chunk vectors
         │
         ▼
5. Top 5 most similar chunks retrieved
         │
         ▼
6. Chunks combined as context string
         │
         ▼
7. Context + Question → Ollama LLM (llama3.1:8b)
         │
         ▼
8. LLM generates answer using ONLY the context
         │
         ▼
9. Answer returned to frontend
```

---

## 🛠️ Configuration

### Environment Variables (`.env`)

```env
API_URL=http://213.210.37.56:8080
API_TOKEN=your_ollama_bearer_token
PORT=3001  # Optional, defaults to 3001
```

### Key Settings

| Setting | Location | Default | Description |
|---------|----------|---------|-------------|
| Chunk Size | `pdf.js` | 800 chars | Size of text chunks |
| Chunk Overlap | `pdf.js` | 100 chars | Overlap between chunks |
| Search Limit | `db.js` | 5 | Number of chunks to retrieve |
| Max File Size | `server.js` | 10MB | PDF upload limit |
| LLM Model | `rag.js` | llama3.1:8b | Ollama model to use |

---

## 🚀 Running the Project

### Prerequisites
- Node.js 18+
- Access to Ollama server (or local Ollama)

### Start Backend
```bash
cd rag-bot
npm install
npm run server
# Runs on http://localhost:3001
```

### Start Frontend
```bash
cd chatbot-ui
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 📊 API Reference

### Create Bot
```bash
POST /api/bots
Content-Type: application/json

{ "name": "My Bot", "website": "https://example.com" }

# Response
{ "botId": "uuid-here", "message": "Bot created successfully" }
```

### Upload PDF
```bash
POST /api/bots/:botId/upload
Content-Type: multipart/form-data

pdf: [file]

# Response
{
  "success": true,
  "filename": "document.pdf",
  "chunks": 15,
  "characters": 12000
}
```

### Chat
```bash
POST /api/bots/:botId/chat
Content-Type: application/json

{ "message": "What is the refund policy?" }

# Response
{ "answer": "According to the document...", "sources": 5 }
```

---

## 🔒 Security Considerations

1. **API Token** - Store in `.env`, never commit to git
2. **CORS** - Configure allowed origins for production
3. **File Validation** - Only PDF files accepted
4. **Bot Isolation** - Each bot only sees its own documents

---

## 🎯 SaaS Multi-Tenancy

The system supports multiple customers (bots) with isolated data:

```
Customer A (Bot ID: abc-123)
  └── Documents only visible to Bot abc-123

Customer B (Bot ID: xyz-789)
  └── Documents only visible to Bot xyz-789
```

Each customer gets:
- Unique Bot ID
- Isolated document storage
- Separate embed code
- Independent chat history

---

## 📝 Limitations

1. **Text PDFs Only** - Scanned/image PDFs not supported (need OCR)
2. **No Persistent Chat** - Conversations not saved
3. **Single File Upload** - One PDF at a time (can upload multiple sequentially)
4. **TF-IDF Search** - Works well but semantic embeddings would be better

---

## 🔮 Future Improvements

- [ ] Add OCR for scanned PDFs (Tesseract)
- [ ] Use vector embeddings (nomic-embed-text)
- [ ] Chat history persistence
- [ ] Multiple file upload
- [ ] User authentication
- [ ] Usage analytics dashboard
- [ ] Rate limiting
- [ ] Webhook notifications

---

## 📄 License

MIT License - Feel free to use for any purpose.

