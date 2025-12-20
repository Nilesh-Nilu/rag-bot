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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (botId) {
      fetchBotInfo();
    }
  }, [botId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchBotInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots/${botId}`);
      if (res.ok) {
        const data = await res.json();
        console.log(data);
      }
    } catch (error) {
      console.error("Error:", error.message);
      console.error("Failed to fetch bot info");
    }
  };

  const createBot = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Chatbot", website: window.location.href }),
      });
      const data = await res.json();
      localStorage.setItem("botId", data.botId);
      setBotId(data.botId);
    } catch (error) {
      console.error("Error:", error.message);
      console.error("Failed to create bot");
    }
  };

  const handleFileUpload = async (file) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!file || !allowedTypes.includes(file.type)) {
      setUploadStatus({ type: "error", message: "Please upload a PDF or DOCX file" });
      return;
    }

    setUploadStatus({ type: "loading", message: "Processing PDF..." });

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
          message: `✅ ${data.filename} uploaded successfully!`,
        });
        setActiveTab("chat");
      } else {
        setUploadStatus({ 
          type: "error", 
          message: data.error || "Upload failed. Make sure it's a text-based PDF." 
        });
      }
    } catch (error) {
      console.error("Error:", error.message);
      setUploadStatus({ type: "error", message: "Upload failed. Check connection." });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (error) {
      console.error("Error:", error.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Cannot connect to server. Make sure the API is running.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyEmbedCode = () => {
    const code = `<script>
  window.ChatbotConfig = {
    apiUrl: '${API_URL}',
    botId: '${botId}',
    theme: 'dark',
    position: 'right'
  };
</script>
<script src="${API_URL}/widget/chatbot.js"></script>`;
    navigator.clipboard.writeText(code);
    alert("Embed code copied to clipboard!");
  };

  if (!botId) {
    return (
      <div className="app">
        <div className="onboarding">
          <div className="onboarding-content">
            <div className="logo-large">🤖</div>
            <h1>Document AI Chatbot</h1>
            <p>Create an AI chatbot that answers questions based on your PDF documents</p>
            <button className="btn-primary" onClick={createBot}>
              Create Your Chatbot
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">📄</span>
              <span>Document AI</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              💬 Chat
            </button>
            <button
              className={`nav-item ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              📤 Upload PDF
            </button>
            <button
              className={`nav-item ${activeTab === "embed" ? "active" : ""}`}
              onClick={() => setActiveTab("embed")}
            >
              🔗 Embed Code
            </button>
          </nav>
          <div className="sidebar-footer">
            <div className="bot-info">
              <span className="status-dot"></span>
              <span>Bot ID: {botId.slice(0, 8)}...</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === "chat" && (
            <div className="chat-panel">
              <div className="chat-header">
                <h2>💬 Chat</h2>
              </div>
              <div className="messages">
                {messages.length === 0 && !isLoading && (
                  <div className="empty-chat">
                    <div className="empty-icon">💬</div>
                    <p>Start a conversation!</p>
                    <span>Say hi or ask a question</span>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === "assistant" ? "🤖" : "👤"}
                    </div>
                    <div className="message-content">
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content typing">
                      <span></span>
                      <span></span>
                      <span></span>
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
                  placeholder="Type a message..."
                  disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="upload-panel">
              <div className="panel-header">
                <h2>📤 Upload Documents</h2>
                <p>Upload PDF or DOCX files to train your chatbot. It will only answer from these documents.</p>
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
                <div className="upload-icon">📄</div>
                <p>Drag & drop PDF or DOCX here</p>
                <span>or click to browse</span>
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
            </div>
          )}

          {activeTab === "embed" && (
            <div className="embed-panel">
              <div className="panel-header">
                <h2>🔗 Embed on Your Website</h2>
                <p>Add this code to your website to show the chatbot widget</p>
              </div>
              <div className="code-block">
                <pre>{`<script>
  window.ChatbotConfig = {
    apiUrl: '${API_URL}',
    botId: '${botId}',
    theme: 'dark',
    position: 'right'
  };
</script>
<script src="${API_URL}/widget/chatbot.js"></script>`}</pre>
                <button className="copy-btn" onClick={copyEmbedCode}>
                  📋 Copy Code
                </button>
              </div>
              <div className="embed-options">
                <h3>Configuration Options</h3>
                <table>
                  <tbody>
                    <tr>
                      <td><code>theme</code></td>
                      <td>'dark' or 'light'</td>
                    </tr>
                    <tr>
                      <td><code>position</code></td>
                      <td>'right' or 'left'</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
