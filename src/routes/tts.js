import { Router } from 'express';
import gTTS from 'gtts';

const router = Router();

// Text-to-Speech endpoint
router.post("/", async (req, res) => {
  try {
    const { text, lang = 'en-uk' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const tts = new gTTS(text, lang);
    const chunks = [];
    const stream = tts.stream();
    
    stream.on('data', (chunk) => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    
    const audioBuffer = Buffer.concat(chunks);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'no-cache',
    });
    
    res.send(audioBuffer);
  } catch (error) {
    console.error("TTS Error:", error.message);
    res.status(500).json({ error: "TTS failed" });
  }
});

export default router;

