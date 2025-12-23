# 🎨 RAG Chatbot UI

A modern React admin dashboard for managing the RAG Chatbot. Built with React 19 and Vite.

---

## ✨ Features

- 🤖 **Bot Creation** - One-click chatbot setup with unique Bot ID
- 📤 **PDF Upload** - Drag & drop PDF upload with processing status
- 💬 **Chat Interface** - Real-time chat with typing indicators
- 🔗 **Embed Generator** - Copy-paste code to add widget to any website
- 💾 **Persistent Sessions** - Bot ID saved to localStorage

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Backend API running on `http://localhost:3001`

### Installation

```bash
# Navigate to frontend directory
cd chatbot-ui

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 📁 Project Structure

```
chatbot-ui/
├── src/
│   ├── App.jsx        # Main application component
│   ├── App.css        # All styles (dark theme)
│   ├── main.jsx       # React entry point
│   └── index.css      # Global styles
├── public/
│   └── vite.svg       # Favicon
├── package.json       # Dependencies & scripts
└── vite.config.js     # Vite configuration
```

---

## 🖥️ UI Components

### Onboarding Screen
When no Bot ID exists, shows a welcome screen with "Create Your Chatbot" button.

### Dashboard Layout
- **Sidebar** - Navigation between Chat, Upload, and Embed tabs
- **Main Content** - Dynamic content based on active tab

### Tabs

| Tab | Description |
|-----|-------------|
| 💬 **Chat** | Send messages and receive AI responses |
| 📤 **Upload PDF** | Drag & drop zone for PDF files |
| 🔗 **Embed Code** | Widget embed code with config options |

---

## 🔧 Configuration

### API URL
Edit `src/App.jsx` to change the backend URL:

```javascript
const API_URL = "http://localhost:3001";
```

For production, update this to your deployed backend URL.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

## 🛠️ Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool & dev server
- **ESLint** - Code linting
- **CSS** - Custom styling (no UI library)

---

## 🎨 Styling

The UI uses a custom dark theme with:
- Gradient backgrounds
- Smooth animations
- Responsive design
- Typing indicator animation

All styles are in `src/App.css`.

---

## 📡 API Integration

The frontend communicates with these backend endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/bots` | Create new bot |
| `GET` | `/api/bots/:botId` | Get bot info |
| `POST` | `/api/bots/:botId/upload` | Upload PDF |
| `POST` | `/api/bots/:botId/chat` | Send chat message |

---

## 🔗 Related

- [Backend Documentation](../README.md) - API server & RAG pipeline
- [Widget Documentation](../widget/) - Embeddable chat widget
