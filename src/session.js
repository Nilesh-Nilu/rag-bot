// Session store for multi-turn conversations
const sessions = new Map();

// Get or create session for a user
export function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      state: 'idle',
      bookingData: {},
      updatePhone: null,
      lastActivity: Date.now()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  return session;
}

// Clean old sessions (older than 30 minutes)
export function startSessionCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > 30 * 60 * 1000) {
        sessions.delete(id);
        console.log(`🗑️ Cleaned up session: ${id}`);
      }
    }
  }, 5 * 60 * 1000);
}

// Reset a session
export function resetSession(sessionId) {
  const session = getSession(sessionId);
  session.state = 'idle';
  session.bookingData = {};
  session.updatePhone = null;
  return session;
}

