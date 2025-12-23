(function() {
  const API_URL = window.ChatbotConfig?.apiUrl || 'http://localhost:3001';
  const BOT_ID = window.ChatbotConfig?.botId || '';
  const THEME = window.ChatbotConfig?.theme || 'dark';
  const POSITION = window.ChatbotConfig?.position || 'right';
  
  // Inject styles
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    .chatbot-widget * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Inter', sans-serif;
    }
    
    .chatbot-widget {
      --bg-primary: ${THEME === 'dark' ? '#0f0f0f' : '#ffffff'};
      --bg-secondary: ${THEME === 'dark' ? '#1a1a1a' : '#f5f5f5'};
      --bg-tertiary: ${THEME === 'dark' ? '#252525' : '#e5e5e5'};
      --text-primary: ${THEME === 'dark' ? '#fafafa' : '#171717'};
      --text-secondary: ${THEME === 'dark' ? '#a1a1aa' : '#737373'};
      --accent: #6366f1;
      --user-bubble: #3b82f6;
      --border: ${THEME === 'dark' ? '#333' : '#e5e5e5'};
      
      position: fixed;
      bottom: 20px;
      ${POSITION}: 20px;
      z-index: 999999;
    }
    
    .chatbot-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--user-bubble));
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
      transition: transform 0.3s, box-shadow 0.3s;
    }
    
    .chatbot-toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
    }
    
    .chatbot-toggle svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    
    .chatbot-window {
      position: absolute;
      bottom: 80px;
      ${POSITION}: 0;
      width: 380px;
      height: 550px;
      background: var(--bg-primary);
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }
    
    .chatbot-window.open {
      display: flex;
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .chatbot-header {
      padding: 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .chatbot-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .chatbot-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--accent), var(--user-bubble));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    
    .chatbot-header h3 {
      color: var(--text-primary);
      font-size: 15px;
      font-weight: 600;
    }
    
    .chatbot-header p {
      color: var(--text-secondary);
      font-size: 12px;
    }
    
    .chatbot-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.2s;
    }
    
    .chatbot-close:hover {
      background: var(--bg-tertiary);
    }
    
    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .chatbot-message {
      display: flex;
      gap: 8px;
      max-width: 85%;
      animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .chatbot-message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    
    .chatbot-message-content {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary);
    }
    
    .chatbot-message.assistant .chatbot-message-content {
      background: var(--bg-secondary);
      border-bottom-left-radius: 4px;
    }
    
    .chatbot-message.user .chatbot-message-content {
      background: linear-gradient(135deg, var(--accent), var(--user-bubble));
      color: white;
      border-bottom-right-radius: 4px;
    }
    
    .chatbot-typing {
      display: flex;
      gap: 4px;
      padding: 14px 18px;
    }
    
    .chatbot-typing span {
      width: 6px;
      height: 6px;
      background: var(--text-secondary);
      border-radius: 50%;
      animation: bounce 1.4s infinite;
    }
    
    .chatbot-typing span:nth-child(2) { animation-delay: 0.2s; }
    .chatbot-typing span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }
    
    .chatbot-input-area {
      padding: 16px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
    }
    
    .chatbot-input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 13px;
      outline: none;
    }
    
    .chatbot-input:focus {
      border-color: var(--accent);
    }
    
    .chatbot-input::placeholder {
      color: var(--text-secondary);
    }
    
    .chatbot-send {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, var(--accent), var(--user-bubble));
      border: none;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    
    .chatbot-send:hover:not(:disabled) {
      transform: scale(1.05);
    }
    
    .chatbot-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .chatbot-send svg {
      width: 18px;
      height: 18px;
      stroke: white;
      fill: none;
    }
    
    .chatbot-upload-zone {
      padding: 20px;
      border: 2px dashed var(--border);
      border-radius: 12px;
      text-align: center;
      margin: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .chatbot-upload-zone:hover {
      border-color: var(--accent);
      background: var(--bg-secondary);
    }
    
    .chatbot-upload-zone.dragover {
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.1);
    }
    
    .chatbot-upload-zone p {
      color: var(--text-secondary);
      font-size: 13px;
    }
    
    .chatbot-upload-zone .icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .chatbot-file-info {
      padding: 12px 16px;
      margin: 16px;
      background: var(--bg-secondary);
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: var(--text-primary);
    }
    
    .chatbot-file-info .icon {
      font-size: 20px;
    }
    
    .chatbot-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
    }
    
    .chatbot-tab {
      flex: 1;
      padding: 12px;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .chatbot-tab.active {
      color: var(--accent);
      border-bottom: 2px solid var(--accent);
    }
    
    .chatbot-tab:hover {
      color: var(--text-primary);
    }
  `;
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
  
  // Create widget HTML
  const widget = document.createElement('div');
  widget.className = 'chatbot-widget';
  widget.innerHTML = `
    <button class="chatbot-toggle" id="chatbot-toggle">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
    <div class="chatbot-window" id="chatbot-window">
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="chatbot-avatar">📄</div>
          <div>
            <h3>Document Assistant</h3>
            <p>Ask about your documents</p>
          </div>
        </div>
        <button class="chatbot-close" id="chatbot-close">✕</button>
      </div>
      <div class="chatbot-tabs">
        <button class="chatbot-tab active" data-tab="chat">💬 Chat</button>
        <button class="chatbot-tab" data-tab="upload">📤 Upload PDF</button>
      </div>
      <div id="chat-tab" class="chatbot-tab-content">
        <div class="chatbot-messages" id="chatbot-messages">
          <div class="chatbot-message assistant">
            <div class="chatbot-message-content">
              Hello! Upload a PDF and ask me anything about it. I'll only answer based on your documents. 📚
            </div>
          </div>
        </div>
        <div class="chatbot-input-area">
          <input type="text" class="chatbot-input" id="chatbot-input" placeholder="Ask about your documents...">
          <button class="chatbot-send" id="chatbot-send">
            <svg viewBox="0 0 24 24" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
      <div id="upload-tab" class="chatbot-tab-content" style="display:none;">
        <div class="chatbot-upload-zone" id="upload-zone">
          <div class="icon">📄</div>
          <p>Drag & drop PDF here<br>or click to browse</p>
          <input type="file" id="file-input" accept=".pdf" style="display:none">
        </div>
        <div id="file-info" style="display:none;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(widget);
  
  // Widget functionality
  const toggle = document.getElementById('chatbot-toggle');
  const window_ = document.getElementById('chatbot-window');
  const close = document.getElementById('chatbot-close');
  const messages = document.getElementById('chatbot-messages');
  const input = document.getElementById('chatbot-input');
  const send = document.getElementById('chatbot-send');
  const tabs = document.querySelectorAll('.chatbot-tab');
  const chatTab = document.getElementById('chat-tab');
  const uploadTab = document.getElementById('upload-tab');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  
  let isLoading = false;
  
  toggle.onclick = () => window_.classList.toggle('open');
  close.onclick = () => window_.classList.remove('open');
  
  // Tab switching
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'chat') {
        chatTab.style.display = 'flex';
        chatTab.style.flexDirection = 'column';
        chatTab.style.flex = '1';
        uploadTab.style.display = 'none';
      } else {
        chatTab.style.display = 'none';
        uploadTab.style.display = 'block';
      }
    };
  });
  
  // File upload
  uploadZone.onclick = () => fileInput.click();
  
  uploadZone.ondragover = (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  };
  
  uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
  
  uploadZone.ondrop = (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      uploadFile(file);
    }
  };
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  };
  
  async function uploadFile(file) {
    uploadZone.innerHTML = '<div class="icon">⏳</div><p>Processing PDF...</p>';
    
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
      const res = await fetch(`${API_URL}/api/bots/${BOT_ID}/upload`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.success) {
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `
          <div class="chatbot-file-info">
            <span class="icon">✅</span>
            <span>\${data.filename} - \${data.chunks} chunks indexed</span>
          </div>
        `;
        uploadZone.innerHTML = '<div class="icon">📄</div><p>Upload another PDF<br>or click to browse</p>';
        
        addMessage('assistant', `Great! I've processed "${data.filename}". You can now ask me questions about it!`);
        
        // Switch to chat tab
        tabs[0].click();
      } else {
        uploadZone.innerHTML = '<div class="icon">❌</div><p>Upload failed. Try again.</p>';
      }
    } catch (err) {
      uploadZone.innerHTML = '<div class="icon">❌</div><p>Upload failed. Check connection.</p>';
    }
  }
  
  // Chat functionality
  function addMessage(role, content) {
    const div = document.createElement('div');
    div.className = `chatbot-message ${role}`;
    div.innerHTML = `<div class="chatbot-message-content">${content}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  
  function showTyping() {
    const div = document.createElement('div');
    div.className = 'chatbot-message assistant';
    div.id = 'typing';
    div.innerHTML = '<div class="chatbot-message-content chatbot-typing"><span></span><span></span><span></span></div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  
  function hideTyping() {
    const typing = document.getElementById('typing');
    if (typing) typing.remove();
  }
  
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;
    
    input.value = '';
    addMessage('user', text);
    isLoading = true;
    send.disabled = true;
    showTyping();
    
    try {
      const res = await fetch(`${API_URL}/api/bots/${BOT_ID}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      const data = await res.json();
      hideTyping();
      addMessage('assistant', data.answer);
    } catch (err) {
      hideTyping();
      addMessage('assistant', 'Connection error. Please try again.');
    }
    
    isLoading = false;
    send.disabled = false;
  }
  
  send.onclick = sendMessage;
  input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
})();

