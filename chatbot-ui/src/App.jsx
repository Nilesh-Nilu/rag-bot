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
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceInputUsed, setVoiceInputUsed] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [language, setLanguage] = useState('en');
  const [sessionId, setSessionId] = useState('');
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧', ttsCode: 'en-uk', speechCode: 'en-IN' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳', ttsCode: 'hi', speechCode: 'hi-IN' },
  ];

  // Generate session ID
  useEffect(() => {
    if (!sessionId) {
      setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
  }, []);

  // Load voices
  useEffect(() => {
    let attempts = 0;
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        if (language === 'hi' && !selectedVoice) {
          const hindiVoice = voices.find(v => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi'));
          if (hindiVoice) setSelectedVoice(hindiVoice.name);
        }
      } else if (attempts < 5) {
        attempts++;
        setTimeout(loadVoices, 500);
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, [language]);

  // Speech recognition
  const createRecognition = (onFinalResult) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const selectedLang = languages.find(l => l.code === language);
    recognition.lang = selectedLang?.speechCode || "en-IN";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (interim) setInput(interim);
      if (final) {
        setInput(final);
        setVoiceInputUsed(true);
        recognition.stop();
        onFinalResult?.(final);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    return recognition;
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [language]);

  const getBestVoice = (lang) => {
    const voices = availableVoices.length > 0 ? availableVoices : speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) return voice;
    }
    const preferredKeywords = ['Google', 'Neural', 'Natural', 'Microsoft'];
    const byQuality = voices.find(v =>
      preferredKeywords.some(k => v.name.toLowerCase().includes(k.toLowerCase()))
      && (lang === 'hi' ? v.lang.toLowerCase().includes('hi') : v.lang.toLowerCase().startsWith('en'))
    );
    if (byQuality) return byQuality;
    if (lang === 'hi') {
      const hindiVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi'));
      if (hindiVoice) return hindiVoice;
    }
    return voices.find(v => v.lang.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en')) || voices[0];
  };

  const audioRef = useRef(null);

  const speakText = async (text, forceSpeak = false) => {
    if ((!voiceEnabled && !forceSpeak) || !text) return;
    stopSpeaking();
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[*_~`#]/g, '').trim();
    if (!cleanText) return;
    setIsSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = getBestVoice(language);
    if (voice) utterance.voice = voice;
    utterance.rate = language === 'hi' ? 0.9 : 0.92;
    utterance.pitch = 1.05;
    utterance.lang = languages.find(l => l.code === language)?.speechCode || 'en-IN';
    utterance.onend = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    setInput("");
    setVoiceInputUsed(false);
    recognitionRef.current = createRecognition(() => {});
    if (!recognitionRef.current) {
      alert("Speech recognition not supported.");
      return;
    }
    try { recognitionRef.current.start(); } catch (e) { setIsListening(false); }
  };

  useEffect(() => {
    if (botId) fetchBotInfo();
  }, [botId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const fetchBotInfo = async () => {
    try {
      await fetch(`${API_URL}/api/bots/${botId}`);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const createBot = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Clinic Bot", website: window.location.href }),
      });
      const data = await res.json();
      localStorage.setItem("botId", data.botId);
      setBotId(data.botId);
    } catch (error) {
      console.error("Failed to create bot");
    }
  };

  const handleFileUpload = async (file) => {
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!file || !allowedTypes.includes(file.type)) {
      setUploadStatus({ type: "error", message: "Please upload a PDF or DOCX file" });
      return;
    }
    setUploadStatus({ type: "loading", message: "Processing document..." });
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch(`${API_URL}/api/bots/${botId}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadStatus({ type: "success", message: `✅ ${data.filename} uploaded!` });
        setActiveTab("chat");
        // Add welcome message
        setMessages([{
          role: "assistant",
          content: language === 'hi' 
            ? "नमस्ते! 🏥 आपका दस्तावेज़ अपलोड हो गया है। आप मुझसे क्लिनिक के बारे में कुछ भी पूछ सकते हैं या अपॉइंटमेंट बुक कर सकते हैं।"
            : "Hello! 🏥 Your document has been uploaded. You can ask me anything about the clinic or book an appointment with any doctor mentioned in the document."
        }]);
      } else {
        setUploadStatus({ type: "error", message: data.error || "Upload failed." });
      }
    } catch (error) {
      setUploadStatus({ type: "error", message: "Upload failed. Check connection." });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  };

  // Send message - unified chat
  const sendMessage = async (e, fromVoice = false) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const wasVoiceInput = fromVoice || voiceInputUsed;

    setInput("");
    setVoiceInputUsed(false);
    setMessages((prev) => [...prev, { role: "user", content: userMessage, fromVoice: wasVoiceInput }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, language, sessionId }),
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (wasVoiceInput || voiceEnabled) speakText(data.answer, wasVoiceInput);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Cannot connect to server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (voiceInputUsed && input.trim()) {
      const timer = setTimeout(() => sendMessage(null, true), 500);
      return () => clearTimeout(timer);
    }
  }, [voiceInputUsed, input]);

  const clearChat = async () => {
    try {
      await fetch(`${API_URL}/api/bots/${botId}/clear-conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const newSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSession);
      setMessages([{
        role: "assistant",
        content: language === 'hi' 
          ? "नमस्ते! 🏥 मैं आपकी कैसे मदद कर सकती हूं? आप मुझसे क्लिनिक के बारे में पूछ सकते हैं या अपॉइंटमेंट बुक कर सकते हैं।"
          : "Hello! 🏥 How can I help you? You can ask me about the clinic or book an appointment."
      }]);
    } catch (error) {
      console.error("Error clearing chat:", error);
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
    alert("Embed code copied!");
  };

  if (!botId) {
    return (
      <div className="app">
        <div className="onboarding">
          <div className="onboarding-content">
            <div className="logo-large">🏥</div>
            <h1>Medical Clinic AI</h1>
            <p>AI assistant that answers questions & books appointments from your clinic documents</p>
            <button className="btn-primary" onClick={createBot}>Get Started</button>
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
              <span className="logo-icon">🏥</span>
              <span>Clinic AI</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button className={`nav-item ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
              💬 Chat & Book
            </button>
            <button className={`nav-item ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>
              📤 Upload Document
            </button>
            <button className={`nav-item ${activeTab === "embed" ? "active" : ""}`} onClick={() => setActiveTab("embed")}>
              🔗 Embed Code
            </button>
          </nav>
          <div className="sidebar-footer">
            <div className="bot-info">
              <span className="status-dot"></span>
              <span>Bot: {botId.slice(0, 8)}...</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === "chat" && (
            <div className="chat-panel">
              <div className="chat-header">
                <h2>💬 Chat & Book Appointments</h2>
                <div className="header-controls">
                  <button className="clear-btn" onClick={clearChat} title="New conversation">🔄 New Chat</button>
                  <select className="language-select" value={language} onChange={(e) => { setLanguage(e.target.value); setSelectedVoice(''); }}>
                    {languages.map(lang => <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>)}
                  </select>
                  {availableVoices.length > 0 && (
                    <select className="voice-select" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                      <option value="">Auto</option>
                      {availableVoices.filter(v => language === 'hi' ? v.lang.includes('hi') : v.lang.startsWith('en')).map(voice => <option key={voice.name} value={voice.name}>{voice.name}</option>)}
                    </select>
                  )}
                  <div className="voice-controls">
                    {isSpeaking && <button className="voice-btn stop" onClick={stopSpeaking}>⏹️</button>}
                    <button className={`voice-btn ${voiceEnabled ? 'active' : ''}`} onClick={() => setVoiceEnabled(!voiceEnabled)}>
                      {voiceEnabled ? '🔊' : '🔇'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && !isLoading && (
                  <div className="empty-chat">
                    <div className="empty-icon">🏥</div>
                    <p>Welcome to Clinic AI!</p>
                    <span>Upload a clinic document first, then ask questions or book appointments</span>
                    <div className="quick-actions">
                      <button onClick={() => setActiveTab("upload")}>📤 Upload Document</button>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === "assistant" ? '🏥' : (msg.fromVoice ? '🎤' : '👤')}
                    </div>
                    <div className="message-content">
                      <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      {msg.role === "assistant" && (
                        <button className="speak-btn" onClick={() => speakText(msg.content, true)}>🔊</button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-avatar">🏥</div>
                    <div className="message-content typing"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="input-area" onSubmit={sendMessage}>
                <button type="button" className={`mic-btn ${isListening ? "listening" : ""}`} onClick={toggleListening}>
                  {isListening ? "🛑" : "🎤"}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
                  }}
                  placeholder={isListening ? "🎤 Listening..." : "Ask about clinic or book appointment..."}
                  className={isListening ? "listening-placeholder" : ""}
                  disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="upload-panel">
              <div className="panel-header">
                <h2>📤 Upload Clinic Document</h2>
                <p>Upload your clinic PDF/DOCX with doctor info, services, timings. The AI will use this to answer questions and book appointments.</p>
              </div>
              <div
                className={`upload-zone ${dragOver ? "dragover" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <div className="upload-icon">📄</div>
                <p>Drag & drop document here</p>
                <span>or click to browse</span>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={(e) => handleFileUpload(e.target.files[0])} style={{ display: "none" }} />
              </div>
              {uploadStatus && <div className={`upload-status ${uploadStatus.type}`}>{uploadStatus.message}</div>}
              <div className="upload-tips">
                <h3>📋 Tips for best results:</h3>
                <ul>
                  <li>Include doctor names and their specialties</li>
                  <li>Add clinic timings and available days</li>
                  <li>List services and consultation fees</li>
                  <li>Include contact information</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "embed" && (
            <div className="embed-panel">
              <div className="panel-header">
                <h2>🔗 Embed on Your Website</h2>
                <p>Add this code to your website</p>
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
                <button className="copy-btn" onClick={copyEmbedCode}>📋 Copy Code</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
