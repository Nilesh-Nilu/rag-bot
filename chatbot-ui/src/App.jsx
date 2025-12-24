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
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    service: 'Project Discussion',
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const calEmbedRef = useRef(null);

  // Show inline booking calendar
  const showInlineCalendar = () => {
    setShowInlineBooking(true);
    setShowBookingForm(false);
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

  // Show custom booking form
  const showCustomBookingForm = () => {
    setShowBookingForm(true);
    setShowInlineBooking(false);
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingForm(prev => ({
      ...prev,
      preferredDate: tomorrow.toISOString().split('T')[0]
    }));
  };

  // Handle booking form input change
  const handleBookingInputChange = (e) => {
    const { name, value } = e.target;
    setBookingForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit booking form
  const submitBooking = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!bookingForm.fullName || !bookingForm.phone || !bookingForm.email || 
        !bookingForm.preferredDate || !bookingForm.preferredTime) {
      const errorMsg = language === 'hi' 
        ? 'कृपया सभी आवश्यक फ़ील्ड भरें।'
        : 'Please fill all required fields.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      return;
    }

    setBookingSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingForm)
      });

      const data = await response.json();

      if (data.success) {
        const successMsg = language === 'hi'
          ? `🎉 बुकिंग सफल!\n\nआपकी बुकिंग कन्फर्म हो गई है:\n👤 ${bookingForm.fullName}\n📞 ${bookingForm.phone}\n📅 ${bookingForm.preferredDate}\n⏰ ${bookingForm.preferredTime}\n\nहमारी टीम जल्द ही आपसे संपर्क करेगी!`
          : `🎉 Booking Successful!\n\nYour appointment is confirmed:\n👤 ${bookingForm.fullName}\n📞 ${bookingForm.phone}\n📅 ${bookingForm.preferredDate}\n⏰ ${bookingForm.preferredTime}\n\nOur team will contact you soon!`;
        
        setMessages(prev => [...prev, { role: 'assistant', content: successMsg }]);
        setShowBookingForm(false);
        
        // Reset form
        setBookingForm({
          fullName: '',
          phone: '',
          email: '',
          service: 'Project Discussion',
          preferredDate: '',
          preferredTime: '',
          notes: ''
        });

        // Speak success message
        if (voiceEnabled) {
          speakText(language === 'hi' ? 'बुकिंग सफल! हमारी टीम जल्द ही आपसे संपर्क करेगी।' : 'Booking successful! Our team will contact you soon.');
        }
      } else {
        throw new Error(data.error || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMsg = language === 'hi'
        ? 'बुकिंग में समस्या हुई। कृपया पुनः प्रयास करें।'
        : 'Booking failed. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setBookingSubmitting(false);
    }
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
      recognitionRef.current.continuous = true; // Keep listening for longer phrases
      recognitionRef.current.interimResults = true; // Show interim results
      recognitionRef.current.maxAlternatives = 3; // Get multiple alternatives

      // Set language based on selection
      const selectedLang = languages.find(l => l.code === language);
      recognitionRef.current.lang = selectedLang?.speechCode || 'en-IN';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Show interim results while speaking
        if (interimTranscript) {
          setInput(interimTranscript);
        }
        
        // When we have final result, process it
        if (finalTranscript) {
          console.log('🎤 Voice input (final):', finalTranscript);
          setInput(finalTranscript.trim());
          setVoiceInputUsed(true);
          setIsListening(false);
          recognitionRef.current.stop();
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language]);

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
      alert('Speech recognition not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput(''); // Clear previous input
      setVoiceInputUsed(false);
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
        
        // Auto-stop after 10 seconds if no speech detected
        setTimeout(() => {
          if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
          }
        }, 10000);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        // Recognition might already be running, try to stop and restart
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current.start();
            setIsListening(true);
          }, 100);
        } catch (e) {
          console.error('Could not restart recognition:', e);
        }
      }
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
                            className="booking-btn"
                            onClick={showCustomBookingForm}
                          >
                            📝 {language === 'hi' ? 'फॉर्म भरें' : 'Quick Book'}
                          </button>
                          <button
                            className="booking-btn secondary"
                            onClick={showInlineCalendar}
                          >
                            📆 {language === 'hi' ? 'कैलेंडर देखें' : 'View Calendar'}
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
                        <span>{language === 'hi' ? 'समय चुनें' : 'Select a time slot'}</span>
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

                {/* Custom Booking Form */}
                {showBookingForm && (
                  <div className="message assistant">
                    <div className="message-avatar">📝</div>
                    <div className="message-content booking-form-container">
                      <div className="booking-embed-header">
                        <span>{language === 'hi' ? '📅 अपॉइंटमेंट बुक करें' : '📅 Book Appointment'}</span>
                        <button
                          className="close-booking-btn"
                          onClick={() => setShowBookingForm(false)}
                        >
                          ✕
                        </button>
                      </div>
                      <form className="booking-form" onSubmit={submitBooking}>
                        <div className="form-group">
                          <label>{language === 'hi' ? '👤 पूरा नाम *' : '👤 Full Name *'}</label>
                          <input
                            type="text"
                            name="fullName"
                            value={bookingForm.fullName}
                            onChange={handleBookingInputChange}
                            placeholder={language === 'hi' ? 'अपना नाम लिखें' : 'Enter your name'}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>{language === 'hi' ? '📞 मोबाइल नंबर *' : '📞 Mobile Number *'}</label>
                          <input
                            type="tel"
                            name="phone"
                            value={bookingForm.phone}
                            onChange={handleBookingInputChange}
                            placeholder="9876543210"
                            pattern="[6-9][0-9]{9}"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>{language === 'hi' ? '📧 ईमेल *' : '📧 Email *'}</label>
                          <input
                            type="email"
                            name="email"
                            value={bookingForm.email}
                            onChange={handleBookingInputChange}
                            placeholder="your@email.com"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>{language === 'hi' ? '🛠️ सेवा' : '🛠️ Service'}</label>
                          <select
                            name="service"
                            value={bookingForm.service}
                            onChange={handleBookingInputChange}
                          >
                            <option value="Project Discussion">Project Discussion</option>
                            <option value="Custom Software Development">Custom Software Development</option>
                            <option value="Mobile App Development">Mobile App Development</option>
                            <option value="Web Development">Web Development</option>
                            <option value="AI/ML Solutions">AI/ML Solutions</option>
                            <option value="Consultation">Consultation</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>{language === 'hi' ? '📅 तारीख *' : '📅 Date *'}</label>
                            <input
                              type="date"
                              name="preferredDate"
                              value={bookingForm.preferredDate}
                              onChange={handleBookingInputChange}
                              min={new Date().toISOString().split('T')[0]}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>{language === 'hi' ? '⏰ समय *' : '⏰ Time *'}</label>
                            <select
                              name="preferredTime"
                              value={bookingForm.preferredTime}
                              onChange={handleBookingInputChange}
                              required
                            >
                              <option value="">{language === 'hi' ? 'समय चुनें' : 'Select time'}</option>
                              <option value="09:00 AM">09:00 AM</option>
                              <option value="10:00 AM">10:00 AM</option>
                              <option value="11:00 AM">11:00 AM</option>
                              <option value="12:00 PM">12:00 PM</option>
                              <option value="02:00 PM">02:00 PM</option>
                              <option value="03:00 PM">03:00 PM</option>
                              <option value="04:00 PM">04:00 PM</option>
                              <option value="05:00 PM">05:00 PM</option>
                              <option value="06:00 PM">06:00 PM</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>{language === 'hi' ? '📝 अतिरिक्त नोट्स' : '📝 Additional Notes'}</label>
                          <textarea
                            name="notes"
                            value={bookingForm.notes}
                            onChange={handleBookingInputChange}
                            placeholder={language === 'hi' ? 'कोई विशेष जानकारी...' : 'Any specific requirements...'}
                            rows="2"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="booking-submit-btn"
                          disabled={bookingSubmitting}
                        >
                          {bookingSubmitting 
                            ? (language === 'hi' ? '⏳ बुक हो रहा है...' : '⏳ Booking...') 
                            : (language === 'hi' ? '✅ बुकिंग कन्फर्म करें' : '✅ Confirm Booking')}
                        </button>
                      </form>
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
