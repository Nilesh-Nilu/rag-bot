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

  // Load voices for TTS - prioritize premium/enhanced voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      setVoices(availableVoices);
      
      // Log available voices for debugging
      console.log("Available voices:", availableVoices.map(v => `${v.name} (${v.lang})`));
      
      // Priority order: Premium/Enhanced voices first, then neural, then standard
      const voicePriority = [
        // macOS Premium voices (most natural)
        "Samantha (Enhanced)", "Samantha (Premium)", 
        "Alex (Enhanced)", "Alex",
        "Ava (Enhanced)", "Ava (Premium)", "Ava",
        "Zoe (Enhanced)", "Zoe (Premium)", "Zoe",
        "Siri", // Siri voices are very natural
        // Google Chrome voices
        "Google UK English Female", "Google UK English Male",
        "Google US English",
        // Microsoft Edge voices (Neural)
        "Microsoft Aria Online", "Microsoft Jenny Online",
        "Microsoft Guy Online", "Microsoft Eric Online",
        // Standard fallbacks
        "Samantha", "Karen", "Daniel", "Moira",
        "Microsoft Zira", "Microsoft David",
      ];
      
      let voice = null;
      for (const pref of voicePriority) {
        voice = availableVoices.find(v => v.name === pref || v.name.includes(pref));
        if (voice) {
          console.log("Selected voice:", voice.name);
          break;
        }
      }
      
      // Fallback: prefer English voices
      if (!voice) {
        voice = availableVoices.find(v => v.lang === "en-US") 
             || availableVoices.find(v => v.lang.startsWith("en")) 
             || availableVoices[0];
        console.log("Fallback voice:", voice?.name);
      }
      
      setSelectedVoice(voice);
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    // Try again after a delay (some browsers load voices async)
    setTimeout(loadVoices, 100);
  }, []);

  // Save voice preference
  useEffect(() => {
    localStorage.setItem("voiceEnabled", voiceEnabled);
  }, [voiceEnabled]);

  // Natural text-to-speech with sentence chunking for realistic pauses
  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return;
    
    synthRef.current.cancel();
    
    // Clean and prepare text
    let cleanText = text
      .replace(/[*_~`#]/g, "") // Remove markdown
      .replace(/\n+/g, " ") // Replace newlines with spaces
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/(\d+)/g, " $1 ") // Add space around numbers for better pronunciation
      .trim();
    
    // Split into sentences for natural pauses between them
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
      
      // Natural speech parameters
      utterance.rate = 0.92; // Slightly slower - more conversational
      utterance.pitch = 1.0; // Natural pitch
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      
      utterance.onend = () => {
        currentIndex++;
        // Small pause between sentences (150-300ms feels natural)
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

  // Stop speaking
  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  // Auto-send timer ref
  const autoSendTimerRef = useRef(null);

  // Speech Recognition functions
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      alert("Voice input not supported in your browser. Try Chrome or Edge.");
      return;
    }

    // Clear any pending auto-send
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
    }

    // Create fresh recognition instance
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
      
      // If final result, set up auto-send after delay
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
        
        // Auto-send after 1 second delay
        if (transcript.trim()) {
          autoSendTimerRef.current = setTimeout(() => {
            // Trigger form submission
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
        body: JSON.stringify({ name: "Company Bot", website: window.location.href }),
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
        // Add welcome message after upload
        const welcomeMsg = { role: "assistant", content: "Hello! 👋 Your document has been uploaded. I can now answer questions about your company and help you book meetings with our team. How can I help you today?" };
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

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Clear auto-send timer
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }

    // Stop any ongoing speech
    stopSpeaking();

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      
      // Speak the response if voice is enabled
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
      // Create new session
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("chatSessionId", newSessionId);
      setMessages([{ role: "assistant", content: "Hello! 👋 How can I help you today? I can answer questions about our company or help you schedule a meeting." }]);
      setHistoryLoaded(true);
    } catch (error) {}
  };

  if (!botId) {
    return (
      <div className="app">
        <div className="onboarding">
          <div className="onboarding-content">
            <div className="logo-large">💼</div>
            <h1>Company AI Assistant</h1>
            <p>AI chatbot that answers questions from your documents and books meetings with your team</p>
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
              <span className="logo-icon">💼</span>
              <span>AI Assistant</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button className={`nav-item ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
              💬 Chat
            </button>
            <button className={`nav-item ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>
              📤 Upload Document
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
                <h2>💬 Chat with AI</h2>
                <div className="header-controls">
                  <button className="clear-btn" onClick={clearChat}>🔄 New Chat</button>
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && !isLoading && (
                  <div className="empty-chat">
                    <div className="empty-icon">💼</div>
                    <p>Welcome!</p>
                    <span>Upload a company document first, then ask questions or book meetings</span>
                    <div className="quick-actions">
                      <button onClick={() => setActiveTab("upload")}>📤 Upload Document</button>
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
                {/* Voice toggle */}
                <button
                  type="button"
                  className={`voice-toggle ${voiceEnabled ? "active" : ""}`}
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  title={voiceEnabled ? "Voice output ON" : "Voice output OFF"}
                >
                  {voiceEnabled ? "🔊" : "🔇"}
                </button>
                
                {/* Mic button */}
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
                  placeholder={isListening ? "Listening..." : "Ask a question or book a meeting..."}
                  disabled={isLoading}
                />
                
                {/* Stop speaking button */}
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
                <p>Upload your company info (PDF/DOCX) - services, team, pricing, FAQs, etc.</p>
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
                <h3>📋 Include in your document:</h3>
                <ul>
                  <li>Company overview and services</li>
                  <li>Team members and their roles</li>
                  <li>Pricing and packages</li>
                  <li>FAQs and contact info</li>
                  <li>Available meeting times</li>
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
