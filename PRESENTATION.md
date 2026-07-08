# PDF RAG AI Chatbot — Presentation Guide

---

## 1. What is RAG?

**RAG = Retrieval-Augmented Generation**

A technique that combines **document retrieval** with **AI text generation** to answer questions grounded in real data.

| Traditional Chatbot | RAG Chatbot |
|---|---|
| Answers from training data only | Answers from **your uploaded documents** |
| Can hallucinate / make up facts | Grounded in actual content — cites sources |
| Generic knowledge | Domain-specific, private knowledge |
| No way to update knowledge | Upload new documents anytime |

### Why RAG matters

- LLMs (like GPT) have a **knowledge cutoff** — they don't know your private data
- RAG bridges this gap: **your documents become the AI's knowledge base**
- The AI only answers from what it can find in your documents — no hallucination

---

## 2. Architecture Overview

The application has three main layers:

- **Frontend (React + Vite)** — The user interface where people upload documents and ask questions
- **Backend (Node.js + Express)** — The API server that runs the RAG pipeline and talks to OpenAI
- **Database (SQLite)** — Stores document chunks, their embeddings, and conversation history

When a user asks a question, the frontend sends it to the backend. The backend searches the database for relevant document pieces, sends them along with the question to OpenAI, and returns the AI-generated answer back to the frontend.

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19 + Vite | Chat UI, file upload, document management |
| Backend | Node.js + Express | REST API, RAG pipeline orchestration |
| Database | SQLite | Store document chunks, embeddings, conversations |
| AI Model | GPT-4o-mini | Generate answers from retrieved context |
| Embeddings | text-embedding-3-small | Convert text to vectors for semantic search |
| PDF Parsing | pdf-parse | Extract text from PDF files |
| DOCX Parsing | mammoth | Extract text from Word documents |

---

## 3. The RAG Pipeline — Step by Step

### Phase A: Document Ingestion (What happens when you upload a PDF)

**Step 1 — Text Extraction**
The system reads the uploaded PDF and extracts all the raw text from every page. For DOCX files, it extracts the text from the Word document structure.

**Step 2 — Chunking**
The extracted text is split into small, meaningful pieces of about 800 characters each. The splitting is done at sentence boundaries so no sentence gets cut in half. There is a 200-character overlap between consecutive chunks so that context is not lost at the edges.

**Step 3 — Embedding**
Each chunk is sent to OpenAI's embedding model (text-embedding-3-small), which converts it into a 1536-dimensional numerical vector. This vector captures the **meaning** of the text — similar meanings produce similar vectors.

**Step 4 — Storage**
The chunk text, its embedding vector, and metadata (source filename, chunk position) are saved to the SQLite database.

#### What is Chunking?

- A PDF can be thousands of words — too long to send to the AI in one go
- We split it into **small, meaningful pieces** (~800 characters each)
- **Overlap** (200 chars) ensures no information is lost at chunk boundaries
- Chunks split at **sentence boundaries** — not mid-sentence

#### What are Embeddings?

- An embedding is a **numerical representation of text meaning**
- The model converts text into a **1536-dimension vector** (a list of 1536 numbers)
- Similar meanings produce similar vectors (close in vector space)
- Example: "revenue growth" and "increase in sales" would have very similar embeddings even though they share no words

---

### Phase B: Question Answering (What happens when you ask a question)

**Step 1 — Embed the Query**
The user's question is converted into a 1536-dimensional vector using the same embedding model that was used for the documents. This ensures they are in the same "vector space."

**Step 2 — Semantic Search**
The query vector is compared against every stored document chunk vector using cosine similarity. Each chunk gets a similarity score between 0.0 (completely unrelated) and 1.0 (identical meaning). The top 5 most relevant chunks are selected, and anything below 0.2 is filtered out.

**Step 3 — Build the Prompt**
A full prompt is assembled with four parts:
1. **System instructions** — tells the AI to only answer from document content, cite sources, and not make things up
2. **Retrieved document chunks** — the top relevant pieces from the search step, with their source filenames
3. **Conversation history** — the last 10 messages so the AI remembers the context of the conversation
4. **The user's question**

**Step 4 — Generate the Answer**
The assembled prompt is sent to GPT-4o-mini. The AI reads the retrieved document content and generates a natural language answer grounded in that content.

**Step 5 — Return the Response**
The answer is sent back to the user along with source citations (which file the information came from and the relevance percentage). Both the user's question and the AI's answer are saved to the conversation history for future context.

---

## 4. How Semantic Search Works

### The Problem with Keyword Search

| User's Question | Text in the Document | Would keyword search find it? | Would semantic search find it? |
|---|---|---|---|
| "company revenue" | "annual sales were $5M" | No — no matching words | Yes — same meaning |
| "who is the CEO" | "led by founder John Smith" | No — "CEO" not mentioned | Yes — understands the role |
| "pricing plans" | "our packages start at $99/mo" | No — different words | Yes — same concept |

Keyword search looks for **exact word matches** and misses all of these. Semantic search understands **meaning** and finds them.

### Cosine Similarity — How it measures relevance

Cosine similarity measures the angle between two vectors. If two vectors point in the same direction, they are similar.

- **1.0** = identical meaning
- **0.7–0.9** = highly relevant
- **0.3–0.6** = somewhat related
- **Below 0.2** = not relevant (we filter these out)

We compute this score for **every stored chunk**, sort by score (highest first), and return the top 5 matches.


## 5. How the AI Generates Answers

### What goes into the prompt

The AI receives a carefully structured prompt with:

1. **System instructions** — Rules like "only answer from document context", "cite your sources", "if the answer isn't in the documents, say so clearly", "don't make up information"
2. **Document context** — The most relevant chunks found by semantic search, each labeled with their source file
3. **Conversation history** — The last 10 messages so the AI understands follow-up questions in context
4. **The user's current question**

## 7. Database Design

The application uses three tables:

**Bots** — Each bot is an independent instance with its own documents and conversations. This allows the system to support multiple separate knowledge bases.

**Documents** — Stores the individual text chunks along with their embedding vectors (as a JSON array of 1536 numbers), the source filename, and the chunk's position in the original document.

**Conversations** — Stores the full chat history organized by session. Each message has a role (user or assistant), the content, and a timestamp. This enables conversation continuity across page reloads.

---

## 8. Frontend Features

| Feature | Description |
|---|---|
| Chat Interface | Send questions and receive AI answers with source citations showing which file the answer came from |
| Document Upload | Drag-and-drop or click-to-browse file upload supporting PDF and DOCX formats |
| Document Management | View all uploaded files with chunk counts, and remove individual documents |
| Source Citations | Each answer displays badges showing the source filename and relevance percentage |
| Conversation History | Chat persists across page reloads using session-based storage |
| New Chat | Clear the current conversation and start fresh while keeping all documents |
| Sidebar | Shows uploaded files at a glance and provides navigation between Chat and Documents tabs |
| Responsive Design | Works on desktop and mobile screens |
| Dark Theme | Modern, clean dark UI built with CSS custom properties |

---

## 9. Complete Request Flow — End to End

1. **User types a question** in the chat input and hits send
2. **Frontend sends a POST request** to the backend with the message and session ID
3. **Backend receives the request** and starts the RAG pipeline
4. **Query embedding** — The question is converted to a 1536-dimension vector via OpenAI's embedding API
5. **Vector search** — The query vector is compared against all stored document chunk vectors using cosine similarity
6. **Top chunks selected** — The 5 most relevant chunks (above 0.2 threshold) are picked
7. **Prompt assembly** — System instructions + retrieved chunks + conversation history + user question are combined
8. **AI generation** — The assembled prompt is sent to GPT-4o-mini, which generates an answer grounded in the document content
9. **Save to database** — Both the user's message and the AI's response are saved to the conversation history
10. **Response returned** — The answer is sent back to the frontend along with source file names and relevance percentages
11. **Frontend renders** — The answer appears in the chat with source citation badges

---

## 10. What Makes This Different from ChatGPT?

| Feature | ChatGPT | This RAG Bot |
|---|---|---|
| Knowledge source | Pre-trained data with a cutoff date | **Your own uploaded documents** |
| Private data | Cannot access your private files | **Works entirely with your private PDFs** |
| Accuracy | May hallucinate or make up facts | **Grounded in actual document content** |
| Source citation | Does not tell you where info came from | **Shows which file and relevance percentage** |
| Customizable | Fixed knowledge base | **Upload any document for any domain** |
| Data privacy | Your data is processed on OpenAI's servers | **Documents stored locally in your own database** |
| Cost | Monthly subscription ($20/month for Plus) | **Pay only per API call (fractions of a cent)** |

---

## 11. Key Numbers

| Metric | Value |
|---|---|
| Embedding model | text-embedding-3-small (1536 dimensions) |
| Chat model | GPT-4o-mini |
| Chunk size | ~800 characters with sentence-aware splitting |
| Chunk overlap | ~200 characters to preserve context across boundaries |
| Max retrieved chunks per query | 5 |
| Similarity threshold | 0.2 minimum (below this is filtered out) |
| Conversation memory | Last 10 messages |
| Max upload size | 20 MB |
| Supported file formats | PDF, DOCX |

---

## 12. Future Improvements

- **Vector database** (like Pinecone or Weaviate) for faster search when the number of documents grows large
- **Streaming responses** so the user sees the answer appearing word by word in real time
- **Multi-user authentication** with login so each user has their own private document space
- **Hybrid search** combining semantic search with keyword search for even better retrieval accuracy
- **Page-level citations** so the answer tells you exactly which page of the PDF the information came from
- **Support more file formats** like TXT, CSV, Excel, and HTML
- **Re-ranking model** to further refine which chunks are most relevant before sending them to the AI
- **Answer quality evaluation** pipeline to automatically measure how well the system is performing

---

## 13. Demo Script

1. **Open the app** — Show the clean UI, point out the Chat and Documents tabs in the sidebar
2. **Upload a PDF** — Drag and drop a file, show the processing status and the chunk count that appears
3. **Ask a simple question** — Ask something clearly answered in the document, show the answer with source citation
4. **Ask a follow-up question** — Demonstrate that the AI remembers the previous conversation context
5. **Ask something NOT in the document** — Show that the AI honestly says it doesn't have that information instead of making something up
6. **Upload a second PDF** — Show that the system supports multiple documents simultaneously
7. **Ask a cross-document question** — Ask something that requires information from both PDFs
8. **Point out source citations** — Highlight the source file badges with relevance percentages on each answer
9. **Delete a document** — Show the document management feature
10. **Start a new chat** — Clear the conversation while keeping all documents intact
