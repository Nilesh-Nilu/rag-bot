import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:3001";
const CAL_LINK = "nilu-tudu-l68h0q/project-discussion";

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
  const [language, setLanguage] = useState('en'); // 'en' for English, 'hi' for Hindi
  const [showInlineBooking, setShowInlineBooking] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const calEmbedRef = useRef(null);

  // Open Cal.com modal
  const openCalModal = () => {
    if (window.Cal) {
      window.Cal.ns["project-discussion"]("modal", {
        calLink: CAL_LINK,
        config: {
          layout: "month_view",
          theme: "dark"
        }
      });
    }
  };

  // Show inline booking calendar
  const showInlineCalendar = () => {
    setShowInlineBooking(true);
    // Initialize inline embed after state update
    setTimeout(() => {
      if (window.Cal && calEmbedRef.current) {
        window.Cal.ns["project-discussion"]("inline", {
          elementOrSelector: calEmbedRef.current,
          calLink: CAL_LINK,
          config: {
            layout: "month_view",
            theme: "dark"
          }
        });
      }
    }, 100);
  };

  // Language options (male Indian voices)
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧', ttsCode: 'en-uk', speechCode: 'en-IN' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳', ttsCode: 'hi', speechCode: 'hi-IN' },
  ];

  // Load available voices - try multiple times
  useEffect(() => {
    let attempts = 0;

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));

      if (voices.length > 0) {
        setAvailableVoices(voices);

        // Auto-select Hindi voice if in Hindi mode
        if (language === 'hi' && !selectedVoice) {
          const hindiVoice = voices.find(v =>
            v.lang.includes('hi') ||
            v.name.toLowerCase().includes('hindi')
          );
          if (hindiVoice) {
            console.log('Auto-selected Hindi voice:', hindiVoice.name);
            setSelectedVoice(hindiVoice.name);
          }
        }
      } else if (attempts < 5) {
        attempts++;
        setTimeout(loadVoices, 500);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, [language]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      // Set language based on selection
      const selectedLang = languages.find(l => l.code === language);
      recognitionRef.current.lang = selectedLang?.speechCode || 'en-IN';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setVoiceInputUsed(true); // Mark that voice was used
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language]);

  // Get best voice based on language (female voices)
  const getBestVoice = (lang) => {
    const voices = availableVoices.length > 0 ? availableVoices : speechSynthesis.getVoices();

    // If user selected a voice, use that
    if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) {
        console.log('Using selected voice:', voice.name);
        return voice;
      }
    }

    console.log('Looking for voice for language:', lang);

    if (lang === 'hi') {
      // Hindi female voices
      const hindiVoice = voices.find(v =>
        v.lang === 'hi-IN' ||
        v.lang === 'hi' ||
        v.name.toLowerCase().includes('hindi') ||
        v.name.includes('हिंदी') ||
        v.name.toLowerCase().includes('lekha') ||
        v.name.toLowerCase().includes('swara')
      );

      if (hindiVoice) {
        console.log('Found Hindi voice:', hindiVoice.name);
        return hindiVoice;
      } else {
        console.warn('No Hindi voice found!');
        alert('No Hindi voice found on your device. Please install Hindi voices in System Settings.');
      }
    }

    // English - prefer female voices
    const femaleNames = ['Samantha', 'Victoria', 'Karen', 'Fiona', 'Moira', 'Tessa', 'Female', 'Veena', 'Lekha', 'Siri'];

    // Find female voice
    for (const name of femaleNames) {
      const voice = voices.find(v => v.name.includes(name));
      if (voice) {
        console.log('Selected female voice:', voice.name);
        return voice;
      }
    }

    // Find any English female voice
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    if (englishVoices.length > 0) {
      console.log('Selected first English voice:', englishVoices[0].name);
      return englishVoices[0];
    }

    // Fallback
    console.log('Using fallback voice:', voices[0]?.name);
    return voices[0];
  };

  // Audio ref for TTS
  const audioRef = useRef(null);

  // Speak text with Edge TTS / System TTS (more natural)
  const speakText = async (text, forceSpeak = false) => {
    if ((!voiceEnabled && !forceSpeak) || !text) return;
    
    stopSpeaking();
    
    const cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
      
    if (!cleanText) return;
    
    setIsSpeaking(true);
    
    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Voice mapping for better quality
      const voiceMap = {
        'en': { 
          preferredVoices: ['Samantha', 'Microsoft Zira', 'Google US English', 'Karen', 'Victoria', 'Fiona'],
          rate: 0.9, 
          pitch: 1.0 
        },
        'hi': { 
          preferredVoices: ['Microsoft Hemant', 'Lekha', 'Google हिन्दी', 'Hindi'],
          rate: 0.85, 
          pitch: 1.0 
        }
      };
      
      const settings = voiceMap[language] || voiceMap['en'];
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      
      // Try to find the best voice
      const voices = speechSynthesis.getVoices();
      let preferredVoice = null;
      
      // First try user-selected voice
      if (selectedVoice) {
        preferredVoice = voices.find(v => v.name === selectedVoice);
      }
      
      // Then try preferred voices list
      if (!preferredVoice) {
        for (const voiceName of settings.preferredVoices) {
          preferredVoice = voices.find(v => 
            v.name.includes(voiceName) || 
            v.name.toLowerCase().includes(voiceName.toLowerCase())
          );
          if (preferredVoice) break;
        }
      }
      
      // Fallback to any matching language voice
      if (!preferredVoice) {
        preferredVoice = voices.find(v => 
          language === 'hi' ? v.lang.includes('hi') : v.lang.includes('en')
        );
      }
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('Using voice:', preferredVoice.name);
      }
      
      // Add natural pauses between sentences
      utterance.text = cleanText
        .replace(/\. /g, '.   ')
        .replace(/\? /g, '?   ')
        .replace(/! /g, '!   ')
        .replace(/\.\.\./g, '......   ');
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      // Small delay for natural feel
      setTimeout(() => speechSynthesis.speak(utterance), 300);
      
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    // Stop ResponsiveVoice
    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }
    // Stop any audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop browser TTS
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Toggle voice listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setVoiceInputUsed(false);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

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

  const sendMessage = async (e, fromVoice = false) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const wasVoiceInput = fromVoice || voiceInputUsed;

    setInput("");
    setVoiceInputUsed(false);
    setShowInlineBooking(false); // Hide booking calendar when new message is sent
    setMessages((prev) => [...prev, { role: "user", content: userMessage, fromVoice: wasVoiceInput }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, language: language }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          bookingUrl: data.bookingUrl,
          isBookingResponse: data.isBookingResponse
        },
      ]);

      // Always speak if voice input was used, or if voice is enabled
      if (wasVoiceInput || voiceEnabled) {
        speakText(data.answer, wasVoiceInput);
      }
    } catch (error) {
      console.error("Error:", error.message);
      const errorMsg = "Cannot connect to server. Make sure the API is running.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-send when voice input is complete
  useEffect(() => {
    if (voiceInputUsed && input.trim()) {
      // Small delay to show the transcribed text before sending
      const timer = setTimeout(() => {
        sendMessage(null, true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [voiceInputUsed, input]);

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
                <div className="header-controls">
                  <select
                    className="language-select"
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      setSelectedVoice(''); // Reset voice selection
                    }}
                    title="Select language"
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>

                  {availableVoices.length > 0 && (
                    <select
                      className="voice-select"
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      title="Select voice"
                    >
                      <option value="">Auto</option>
                      {availableVoices
                        .filter(v => language === 'hi' ?
                          (v.lang.includes('hi') || v.name.toLowerCase().includes('hindi')) :
                          v.lang.startsWith('en'))
                        .map(voice => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name}
                          </option>
                        ))}
                    </select>
                  )}

                  <div className="voice-controls">
                    {isSpeaking && (
                      <button className="voice-btn stop" onClick={stopSpeaking} title="Stop speaking">
                        ⏹️
                      </button>
                    )}
                    <button
                      className={`voice-btn ${voiceEnabled ? 'active' : ''}`}
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                    >
                      {voiceEnabled ? '🔊' : '🔇'}
                    </button>
                  </div>
                </div>
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
                      {msg.role === "assistant" ? "🤖" : (msg.fromVoice ? "🎤" : "👤")}
                    </div>
                    <div className="message-content">
                      <p>{msg.content}</p>
                      {msg.isBookingResponse && (
                        <div className="booking-options">
                     
                          <button
                            className="booking-btn secondary"
                            onClick={showInlineCalendar}
                          >
                            📆 View Calendar
                          </button>
                        </div>
                      )}
                      {msg.role === "assistant" && (
                        <button
                          className="speak-btn"
                          onClick={() => speakText(msg.content, true)}
                          title="Listen to this message"
                        >
                          🔊
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Inline Booking Calendar */}
                {showInlineBooking && (
                  <div className="message assistant">
                    <div className="message-avatar">📅</div>
                    <div className="message-content booking-embed-container">
                      <div className="booking-embed-header">
                        <span>Select a time slot</span>
                        <button
                          className="close-booking-btn"
                          onClick={() => setShowInlineBooking(false)}
                        >
                          ✕
                        </button>
                      </div>
                      <div
                        ref={calEmbedRef}
                        className="cal-inline-embed"
                        style={{ width: '100%', minHeight: '400px' }}
                      />
                    </div>
                  </div>
                )}
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
                <button
                  type="button"
                  className={`mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={toggleListening}
                  disabled={isLoading}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  🎤
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? "Listening..." : "Type or speak a message..."}
                  disabled={isLoading || isListening}
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
