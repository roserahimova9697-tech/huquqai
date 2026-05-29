// ════════════════════════════════════════════════════════
//  HuquqAI Backend Server
//  O'zbekiston Qonunchiligiga Asoslangan AI Maslahat
// ════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.options("*", cors());
app.use(express.json({ limit: '20mb' })); // JSON so'rovlar (max 20MB)
app.use(express.urlencoded({ extended: true }));

// ── Fayl yuklash sozlamasi ────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),        // Faylni xotiraga saqla (diskka emas)
  limits: { fileSize: 10 * 1024 * 1024 } // Max 10MB
});

// ── Statik fayllar (frontend) ─────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════
//  ROUTE 1: Sog'liqni tekshirish
// ════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    status : 'ok',
    message: 'HuquqAI server ishlamoqda ✅',
    time   : new Date().toISOString(),
    provider: process.env.AI_PROVIDER || 'groq'
  });
});

// ════════════════════════════════════════════════════════
//  ROUTE 2: AI ga savol yuborish
// ════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, mode = 'umumiy', systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages maydoni kerak' });
    }

    const provider = process.env.AI_PROVIDER || 'groq';
    const reply    = await callAI(messages, mode, systemPrompt, provider);

    res.json({ reply, provider });

  } catch (err) {
    console.error('Chat xatosi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  ROUTE 3: Fayl biriktirgan holda savol
// ════════════════════════════════════════════════════════
app.post('/api/chat-with-file', upload.array('files', 5), async (req, res) => {
  try {
    const { message, mode = 'umumiy', messagesJson } = req.body;
    const files    = req.files || [];
    const messages = JSON.parse(messagesJson || '[]');

    // Fayllarni matn va rasm sifatida tayyorlash
    let fileContext = '';
    const imageFiles = [];

    for (const file of files) {
      const isImage = file.mimetype.startsWith('image/');
      if (isImage) {
        const b64 = file.buffer.toString('base64');
        imageFiles.push({ mimeType: file.mimetype, data: b64, name: file.originalname });
      } else {
        // Matn fayllar (txt, pdf qisman)
        try {
          const text = file.buffer.toString('utf-8').substring(0, 4000);
          fileContext += `\n\n--- FAYL: ${file.originalname} ---\n${text}\n--- TUGADI ---`;
        } catch {
          fileContext += `\n[${file.originalname} — matn o'qilmadi]`;
        }
      }
    }

    const fullMessage = (message || '') + fileContext;
    messages.push({ role: 'user', content: fullMessage });

    const provider = process.env.AI_PROVIDER || 'groq';
    const reply    = await callAI(messages, mode, null, provider, imageFiles);

    res.json({ reply, provider });

  } catch (err) {
    console.error('Fayl chat xatosi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  ROUTE 4: Hujjat yaratish
// ════════════════════════════════════════════════════════
app.post('/api/create-doc', async (req, res) => {
  try {
    const { docType, extraInfo = '', mode = 'umumiy' } = req.body;

    const docPrompts = {
      mehnat_shartnoma : "O'zbekiston Respublikasi Mehnat Kodeksiga muvofiq to'liq rasmiy mehnat shartnomasi shablonini tuzib ber. [TO'LDIRISH KERAK] belgilari qo'y. Barcha majburiy bandlar bo'lsin.",
      ijara_shartnoma  : "O'zbekiston Respublikasi Fuqarolik Kodeksiga muvofiq ko'chmas mulk ijara shartnomasi shablonini tuzib ber. [TO'LDIRISH KERAK] belgilari qo'y.",
      ishonchnoma      : "O'zbekiston qonunchiligi asosida notarial ishonchnoma shablonini tuzib ber. [TO'LDIRISH KERAK] belgilari qo'y.",
      ariza            : "Sudga yoki davlat organiga rasmiy ariza shablonini tuzib ber. [TO'LDIRISH KERAK] belgilari qo'y.",
      qarz_shartnoma   : "O'zbekiston Fuqarolik Kodeksiga muvofiq qarz shartnomasi shablonini tuzib ber. [TO'LDIRISH KERAK] belgilari qo'y.",
      xizmat_shartnoma : "Xizmat ko'rsatish shartnomasi shablonini tuzib ber. O'zbekiston qonunchiligiga mos. [TO'LDIRISH KERAK] belgilari qo'y.",
      talabnoma        : "Rasmiy talabnoma (pretenziya) shablonini tuzib ber. [TO'LDIRISH KERAK] belgilari qo'y.",
    };

    const prompt = (docPrompts[docType] || "Yuridik hujjat shablonini tuzib ber.") +
                   (extraInfo ? `\n\nQo'shimcha ma'lumot: ${extraInfo}` : '');

    const messages = [{ role: 'user', content: prompt }];
    const provider = process.env.AI_PROVIDER || 'groq';
    const reply    = await callAI(messages, mode, null, provider);

    res.json({ document: reply, docType, provider });

  } catch (err) {
    console.error('Hujjat yaratish xatosi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  AI PROVAYDER FUNKSIYASI
// ════════════════════════════════════════════════════════
async function callAI(messages, mode, customSystem, provider, imageFiles = []) {

  // ── Tizim so'rovi (system prompt) ──────────────────────
  const sysPrompt = customSystem || buildSystemPrompt(mode);

  // ── GROQ ───────────────────────────────────────────────
  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY .env faylida topilmadi');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model      : 'llama-3.3-70b-versatile',
        max_tokens : 2000,
        temperature: 0.3,
        messages   : [
          { role: 'system', content: sysPrompt },
          ...messages.map(m => ({
            role   : m.role,
            content: typeof m.content === 'string' ? m.content
                   : Array.isArray(m.content)
                     ? m.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
                     : String(m.content)
          }))
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`Groq: ${data.error.message}`);
    return data.choices[0].message.content;
  }

  // ── GEMINI ─────────────────────────────────────────────
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY .env faylida topilmadi');

    const geminiMsgs = messages.map(m => {
      let parts = [];
      const content = typeof m.content === 'string' ? m.content : String(m.content);
      parts.push({ text: content });

      // Rasmlarni qo'shish (oxirgi user xabariga)
      if (m.role === 'user' && imageFiles.length > 0) {
        imageFiles.forEach(img => {
          parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
        });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          system_instruction: { parts: [{ text: sysPrompt }] },
          contents          : geminiMsgs,
          generationConfig  : { maxOutputTokens: 2000, temperature: 0.3 }
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(`Gemini: ${data.error.message}`);
    return data.candidates[0].content.parts[0].text;
  }

  // ── ANTHROPIC CLAUDE ───────────────────────────────────
  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY .env faylida topilmadi');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method : 'POST',
      headers: {
        'Content-Type'     : 'application/json',
        'x-api-key'        : apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model     : 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system    : sysPrompt,
        messages
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`Anthropic: ${data.error.message}`);
    return data.content[0].text;
  }

  throw new Error(`Noto'g'ri provayder: ${provider}`);
}

// ════════════════════════════════════════════════════════
//  TIZIM SO'ROVI YARATISH
// ════════════════════════════════════════════════════════
function buildSystemPrompt(mode) {
  const modeNames = {
    umumiy      : 'Umumiy huquq',
    mehnat      : 'Mehnat huquqi (Mehnat Kodeksi)',
    soliq       : 'Soliq huquqi (Soliq Kodeksi)',
    mulk        : 'Mulk va ko\'chmas mulk huquqi (Fuqarolik Kodeksi)',
    tadbirkorlik: 'Tadbirkorlik huquqi',
    oila        : 'Oila va meros huquqi (Oila Kodeksi)',
    jinoyat     : 'Jinoyat huquqi (JK va JPK)',
  };

  return `Siz O'zbekiston Respublikasining yuridik maslahatchi va hujjat tuzuvchi AI yordamchisisiz.

Asosiy vazifangiz:
1. O'zbekiston qonunlari asosida yuridik maslahat berish
2. Rasmiy yuridik hujjatlar (shartnoma, ariza, ishonchnoma) shablonlarini tuzish
3. Qonun moddalari va normativ aktlarga aniq havola qilish
4. Yuklangan fayllar va rasmlarni tahlil qilish

Muhim qoidalar:
- FAQAT O'zbekiston Respublikasining amaldagi qonunlariga asoslaning
- Joriy huquq sohasi: ${modeNames[mode] || modeNames.umumiy}
- O'zbek tilida javob bering (rasmiy va aniq tilda)
- Hujjat so'ralsa: to'liq rasmiy shablon bering, [TO'LDIRISH KERAK] belgilari bilan
- Qonun moddasini aniq ko'rsating (masalan: Mehnat Kodeksi 77-modda)
- Javob oxirida qaysi qonun/kodeks asosida javob bergani ko'rsatilsin
- Muhim masalalar uchun advokat bilan maslahatlashishni tavsiya eting`;
}

// ════════════════════════════════════════════════════════
//  Asosiy sahifani qaytarish
// ════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'HuquqAI server ishlayapti. public/index.html qo\'ying.' });
  }
});

// ── Serverni ishga tushirish ──────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════╗');
  console.log('║   ⚖️  HuquqAI Server Ishlamoqda   ║');
  console.log(`║   🌐 http://localhost:${PORT}          ║`);
  console.log(`║   🤖 Provayder: ${(process.env.AI_PROVIDER || 'groq').padEnd(18)}║`);
  console.log('╚════════════════════════════════════╝');
  console.log('');
});
