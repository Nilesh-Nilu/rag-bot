import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

const API_URL = "http://localhost:3001";

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [botId, setBotId] = useState(localStorage.getItem("botId") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem("chatSessionId");
    return saved || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  const [historyLoaded, setHistoryLoaded] = useState(false);
  
  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("voiceEnabled") === "true");
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Quick action buttons for sales flow
  const quickActions = [
    { icon: "🚀", label: "Services", message: "What services do you offer?" },
    { icon: "💰", label: "Pricing", message: "I want to know the project cost estimation" },
    { icon: "👨‍💻", label: "Hire Developer", message: "I want to hire a developer" },
    { icon: "🤖", label: "MVP", message: "Tell me about MVP development packages" },
    { icon: "📞", label: "Schedule Call", message: "I want to schedule a call with your team" },
  ];

  // Save sessionId to localStorage whenever it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("chatSessionId", sessionId);
    }
  }, [sessionId]);

  // Load chat history when botId and sessionId are available
  useEffect(() => {
    if (botId && sessionId && !historyLoaded) {
      loadChatHistory();
    }
  }, [botId, sessionId]);

  const loadChatHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots/${botId}/chat-history?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map(m => ({ role: m.role, content: m.content })));
      }
      setHistoryLoaded(true);
    } catch (error) {
      console.error("Failed to load chat history");
      setHistoryLoaded(true);
    }
  };

  // Load voices for TTS
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      setVoices(availableVoices);
      
      const voicePriority = [
        "Samantha (Enhanced)", "Samantha (Premium)", 
        "Alex (Enhanced)", "Alex",
        "Ava (Enhanced)", "Ava (Premium)", "Ava",
        "Google UK English Female", "Google UK English Male",
        "Google US English",
        "Microsoft Aria Online", "Microsoft Jenny Online",
        "Samantha", "Karen", "Daniel",
      ];
      
      let voice = null;
      for (const pref of voicePriority) {
        voice = availableVoices.find(v => v.name === pref || v.name.includes(pref));
        if (voice) break;
      }
      
      if (!voice) {
        voice = availableVoices.find(v => v.lang === "en-US") 
             || availableVoices.find(v => v.lang.startsWith("en")) 
             || availableVoices[0];
      }
      
      setSelectedVoice(voice);
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    setTimeout(loadVoices, 100);
  }, []);

  useEffect(() => {
    localStorage.setItem("voiceEnabled", voiceEnabled);
  }, [voiceEnabled]);

  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return;
    
    synthRef.current.cancel();
    
    let cleanText = text
      .replace(/[*_~`#]/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/(\d+)/g, " $1 ")
      .trim();
    
    const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    
    let currentIndex = 0;
    
    const speakNext = () => {
      if (currentIndex >= sentences.length) {
        setIsSpeaking(false);
        return;
      }
      
      const sentence = sentences[currentIndex].trim();
      if (!sentence) {
        currentIndex++;
        speakNext();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(sentence);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      
      utterance.onend = () => {
        currentIndex++;
        setTimeout(speakNext, 150 + Math.random() * 150);
      };
      
      utterance.onerror = (e) => {
        console.error("Speech error:", e);
        setIsSpeaking(false);
      };
      
      synthRef.current.speak(utterance);
    };
    
    setIsSpeaking(true);
    speakNext();
  }, [voiceEnabled, selectedVoice]);

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  const autoSendTimerRef = useRef(null);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      alert("Voice input not supported in your browser. Try Chrome or Edge.");
      return;
    }

    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
        
        if (transcript.trim()) {
          autoSendTimerRef.current = setTimeout(() => {
            const form = document.querySelector('.input-area');
            if (form) {
              form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
          }, 1000);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    if (botId) fetchBotInfo();
  }, [botId]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const fetchBotInfo = async () => {
    try { await fetch(`${API_URL}/api/bots/${botId}`); } catch (e) {}
  };

  const createBot = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Murmu Software Bot", website: "murmusoftware.com" }),
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
        const welcomeMsg = { 
          role: "assistant", 
          content: `👋 Welcome to Murmu Software Infotech!

We help businesses build:
✔ Custom Software & Platforms
✔ AI & MVP Solutions
✔ Enterprise & CMS Implementations
✔ Dedicated Development Teams

How can I help you today?

1. 🚀 Software Development Services
2. 💰 Project Cost Estimation
3. 👨‍💻 Hire Developers
4. 🤖 AI/MVP Development
5. 🏢 Enterprise Solutions
6. 📞 Schedule a Call` 
        };
        setMessages(prev => [...prev, welcomeMsg]);
      } else {
        setUploadStatus({ type: "error", message: data.error || "Upload failed." });
      }
    } catch (error) {
      setUploadStatus({ type: "error", message: "Upload failed." });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  };

  const sendMessage = async (e, quickMessage = null) => {
    if (e) e.preventDefault();
    const messageToSend = quickMessage || input.trim();
    if (!messageToSend || isLoading) return;

    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }

    stopSpeaking();

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: messageToSend }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, sessionId }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      
      if (voiceEnabled && data.answer) {
        speak(data.answer);
      }
      
      if (data.sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("chatSessionId", data.sessionId);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Cannot connect to server." }]);
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
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("chatSessionId", newSessionId);
      setMessages([{ 
        role: "assistant", 
        content: `👋 Welcome to Murmu Software Infotech!

We help businesses build:
✔ Custom Software & Platforms
✔ AI & MVP Solutions
✔ Enterprise & CMS Implementations
✔ Dedicated Development Teams

How can I help you today?` 
      }]);
      setHistoryLoaded(true);
    } catch (error) {}
  };

  if (!botId) {
    return (
      <div className="app">
        <div className="onboarding">
          <div className="onboarding-content">
            <div className="logo-large">🏢</div>
            <h1>Murmu Software Infotech</h1>
            <p>AI-Powered Sales Assistant for Custom Software, AI/MVP Solutions, and Enterprise Platforms</p>
            <div className="features-list">
              <div className="feature-item">🚀 Software Development</div>
              <div className="feature-item">🤖 AI & Automation</div>
              <div className="feature-item">💼 Hire Developers</div>
              <div className="feature-item">📊 Enterprise Solutions</div>
            </div>
            <button className="btn-primary" onClick={createBot}>Start Conversation</button>
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
              <span className="logo-icon">🏢</span>
              <span>Murmu Software</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button className={`nav-item ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
              💬 Sales Chat
            </button>
            <button className={`nav-item ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>
              📤 Company Docs
            </button>
          </nav>
          <div className="sidebar-services">
            <h4>Quick Actions</h4>
            {quickActions.map((action, i) => (
              <button 
                key={i} 
                className="service-btn"
                onClick={() => { setActiveTab("chat"); sendMessage(null, action.message); }}
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="bot-info">
              <span className="status-dot"></span>
              <span>Online</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === "chat" && (
            <div className="chat-panel">
              <div className="chat-header">
                <div className="header-info">
                  <h2>🤖 Sales Assistant</h2>
                  <span className="header-subtitle">Pre-Sales • Cost Estimation • Meeting Scheduler</span>
                </div>
                <div className="header-controls">
                  <button className="clear-btn" onClick={clearChat}>🔄 New Chat</button>
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && !isLoading && (
                  <div className="empty-chat">
                    <div className="empty-icon">🏢</div>
                    <h2>Welcome to Murmu Software Infotech!</h2>
                    <p>Your AI-powered sales assistant. I can help you with:</p>
                    <div className="empty-features">
                      <div className="empty-feature">💰 Project Cost Estimation</div>
                      <div className="empty-feature">👨‍💻 Developer Hiring Rates</div>
                      <div className="empty-feature">🤖 MVP Development Packages</div>
                      <div className="empty-feature">📞 Schedule Expert Consultation</div>
                    </div>
                    <div className="quick-actions">
                      <button onClick={() => setActiveTab("upload")}>📤 Upload Company Document First</button>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === "assistant" ? '🤖' : '👤'}
                    </div>
                    <div className="message-content">
                      <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content typing"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="input-area" onSubmit={sendMessage}>
                <button
                  type="button"
                  className={`voice-toggle ${voiceEnabled ? "active" : ""}`}
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  title={voiceEnabled ? "Voice output ON" : "Voice output OFF"}
                >
                  {voiceEnabled ? "🔊" : "🔇"}
                </button>
                
                <button
                  type="button"
                  className={`mic-btn ${isListening ? "listening" : ""}`}
                  onClick={toggleListening}
                  disabled={isLoading}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? "🎤" : "🎙️"}
                </button>
                
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? "Listening..." : "Ask about services, pricing, or schedule a call..."}
                  disabled={isLoading}
                />
                
                {isSpeaking && (
                  <button type="button" className="stop-btn" onClick={stopSpeaking} title="Stop speaking">
                    ⏹️
                  </button>
                )}
                
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
                <h2>📤 Upload Company Document</h2>
                <p>Upload your company info (PDF/DOCX) - services, team, pricing, etc.</p>
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
                <h3>📋 Recommended Content:</h3>
                <ul>
                  <li>✓ Company overview and services</li>
                  <li>✓ Team members and roles</li>
                  <li>✓ Pricing packages (MVP, Enterprise)</li>
                  <li>✓ Developer hiring rates</li>
                  <li>✓ Technology stack</li>
                  <li>✓ Case studies / Portfolio</li>
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
