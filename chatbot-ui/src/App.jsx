import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:3001";

function App() {
  const [botId, setBotId] = useState(localStorage.getItem("botId") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [sessionId, setSessionId] = useState(() => {
    return (
      localStorage.getItem("chatSessionId") ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  });
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (sessionId) localStorage.setItem("chatSessionId", sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!botId) {
      createBot();
    } else {
      loadDocuments();
    }
  }, [botId]);

  useEffect(() => {
    if (botId && sessionId && !historyLoaded) loadChatHistory();
  }, [botId, sessionId]);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createBot = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My RAG Bot" }),
      });
      const data = await res.json();
      localStorage.setItem("botId", data.botId);
      setBotId(data.botId);
    } catch (error) {
      console.error("Failed to create bot");
    }
  };

  const loadChatHistory = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/bots/${botId}/chat-history?sessionId=${sessionId}`
      );
      const data = await res.json();
      if (data.messages?.length > 0) {
        setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
      }
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  };

  const loadDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots/${botId}/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {}
  };

  const handleFileUpload = async (file) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!file || !allowedTypes.includes(file.type)) {
      setUploadStatus({ type: "error", message: "Please upload a PDF or DOCX file" });
      return;
    }
    setUploadStatus({ type: "loading", message: `Processing ${file.name}...` });
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch(`${API_URL}/api/bots/${botId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadStatus({
          type: "success",
          message: `${data.filename} uploaded — ${data.chunks} chunks indexed`,
        });
        loadDocuments();
      } else {
        setUploadStatus({ type: "error", message: data.error || "Upload failed." });
      }
    } catch {
      setUploadStatus({ type: "error", message: "Upload failed. Is the server running?" });
    }
  };

  const deleteDoc = async (sourceFile) => {
    try {
      await fetch(`${API_URL}/api/bots/${botId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFile }),
      });
      loadDocuments();
    } catch {}
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    const msg = input.trim();
    if (!msg || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId }),
      });
      const data = await response.json();
      const sources = data.sources?.filter((s) => s.relevance > 20) || [];
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources },
      ]);
      if (data.sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("chatSessionId", data.sessionId);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Cannot connect to server. Make sure the backend is running." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await fetch(`${API_URL}/api/bots/${botId}/clear-conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {}
    const newSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSession);
    localStorage.setItem("chatSessionId", newSession);
    setMessages([]);
    setHistoryLoaded(true);
  };

  return (
    <div className="app">
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>PDF RAG</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat
            </button>
            <button
              className={`nav-item ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Documents
            </button>
          </nav>

          {documents.length > 0 && (
            <div className="sidebar-docs">
              <h4>Uploaded Files</h4>
              {documents.map((doc, i) => (
                <div key={i} className="doc-item">
                  <div className="doc-info">
                    <span className="doc-name" title={doc.source_file}>
                      {doc.source_file}
                    </span>
                    <span className="doc-chunks">{doc.chunks} chunks</span>
                  </div>
                  <button className="doc-delete" onClick={() => deleteDoc(doc.source_file)} title="Remove">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="sidebar-footer">
            <div className="bot-info">
              <span className="status-dot"></span>
              <span>Connected</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === "chat" && (
            <div className="chat-panel">
              <div className="chat-header">
                <div className="header-info">
                  <h2>Ask your documents</h2>
                  <span className="header-subtitle">
                    {documents.length > 0
                      ? `${documents.length} document${documents.length > 1 ? "s" : ""} loaded`
                      : "Upload a PDF to get started"}
                  </span>
                </div>
                <div className="header-controls">
                  <button className="clear-btn" onClick={clearChat}>
                    New Chat
                  </button>
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && !isLoading && (
                  <div className="empty-chat">
                    <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <h2>PDF RAG Assistant</h2>
                    <p>Upload PDFs and ask questions about their content</p>
                    <div className="empty-features">
                      <div className="empty-feature">
                        <strong>Upload</strong>
                        <span>PDF or DOCX files</span>
                      </div>
                      <div className="empty-feature">
                        <strong>Ask</strong>
                        <span>Questions in natural language</span>
                      </div>
                      <div className="empty-feature">
                        <strong>Get</strong>
                        <span>Answers with source citations</span>
                      </div>
                      <div className="empty-feature">
                        <strong>Manage</strong>
                        <span>Multiple documents at once</span>
                      </div>
                    </div>
                    {documents.length === 0 && (
                      <button className="btn-primary" onClick={() => setActiveTab("upload")}>
                        Upload your first document
                      </button>
                    )}
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === "assistant" ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                          <line x1="9" y1="9" x2="9.01" y2="9" />
                          <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                    <div className="message-bubble">
                      <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                      {msg.sources?.length > 0 && (
                        <div className="message-sources">
                          {msg.sources.map((s, j) => (
                            <span key={j} className="source-tag">
                              {s.file} ({s.relevance}%)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="message assistant">
                    <div className="message-avatar">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </div>
                    <div className="message-bubble typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="input-area" onSubmit={sendMessage}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    documents.length > 0
                      ? "Ask a question about your documents..."
                      : "Upload a document first, then ask questions..."
                  }
                  disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="upload-panel">
              <div className="panel-header">
                <h2>Upload Documents</h2>
                <p>Upload PDF or DOCX files to build your knowledge base</p>
              </div>

              <div
                className={`upload-zone ${dragOver ? "dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <svg className="upload-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Drag & drop files here</p>
                <span>or click to browse — PDF, DOCX up to 20MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </div>

              {uploadStatus && (
                <div className={`upload-status ${uploadStatus.type}`}>
                  {uploadStatus.message}
                </div>
              )}

              {documents.length > 0 && (
                <div className="documents-list">
                  <h3>Uploaded Documents</h3>
                  {documents.map((doc, i) => (
                    <div key={i} className="document-card">
                      <div className="document-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div>
                          <span className="document-name">{doc.source_file}</span>
                          <span className="document-meta">{doc.chunks} chunks</span>
                        </div>
                      </div>
                      <button
                        className="document-delete"
                        onClick={() => deleteDoc(doc.source_file)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
