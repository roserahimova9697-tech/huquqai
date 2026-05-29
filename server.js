
// HuquqAI Backend Server — lex.uz integratsiya bilan
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Qonunlar bazasi (lex.uz dan oldindan tayyorlangan) ────
const LAWS_DB = {
  mehnat: {
    name: "Mehnat Kodeksi",
    url: "https://lex.uz/docs/3918556",
    articles: {
      "77": "Mehnat shartnomasi — ikki tomon (ish beruvchi va xodim) o'rtasida yozma shaklda tuziladi. Majburiy bandlar: ish joyi, lavozim, maosh miqdori, ish vaqti, ta'til muddati.",
      "100": "Ish haqi — belgilangan muddatlarda, oyda kamida 2 marta to'lanishi shart.",
      "106": "Ish vaqti — haftalik 40 soatdan oshmasligi kerak. Qisqartirilgan ish vaqti: 16 yoshgacha — 24 soat, 16-18 yoshgacha — 36 soat.",
      "134": "Ta'til — yiliga kamida 15 ish kuni asosiy mehnat ta'tili beriladi.",
      "161": "Ishdan bo'shatish asoslari: xodimning xohishi, tomonlarning kelishuvi, shartnoma muddati tugashi, ish beruvchi tashabbusi.",
      "170": "Ish beruvchi tashabbusi bilan bo'shatishda 2 haftalik ogohlantirish va qonuniy kompensatsiya to'lanishi shart.",
    }
  },
  soliq: {
    name: "Soliq Kodeksi",
    url: "https://lex.uz/docs/4674902",
    articles: {
      "237": "QQS (Qo'shilgan qiymat solig'i) — 12% stavkada hisoblanadi. Yillik aylanmasi 1 mlrd so'mdan oshgan korxonalar QQS to'lovchi hisoblanadi.",
      "266": "Daromad solig'i — jismoniy shaxslar uchun 12%, yuridik shaxslar uchun 15%.",
      "295": "Ijtimoiy soliq — ish haqi fondidan 12% miqdorida hisoblanadi.",
      "350": "Soliq hisoboti — choraklik va yillik hisobotlar belgilangan muddatlarda topshiriladi.",
      "400": "Soliq imtiyozlari — nogironlar, pensionerlar va ayrim tashkilotlar uchun imtiyozlar mavjud.",
    }
  },
  fuqarolik: {
    name: "Fuqarolik Kodeksi",
    url: "https://lex.uz/docs/111181",
    articles: {
      "354": "Shartnoma — tomonlarning o'zaro kelishuvi asosida tuziladi. Yozma yoki og'zaki shaklda bo'lishi mumkin.",
      "460": "Oldi-sotdi shartnomasi — mol-mulkni bir tomondan ikkinchi tomonga o'tkazishni tartibga soladi.",
      "535": "Ijara shartnomasi — mol-mulkni vaqtincha foydalanishga berish shartlarini belgilaydi.",
      "732": "Qarz shartnomasi — pul yoki boshqa qimmatliklarni belgilangan muddatga berish.",
      "1135": "Meros — vafot etgan shaxsning mol-mulki qonun yoki vasiyatnoma asosida vorislarga o'tadi.",
    }
  },
  oila: {
    name: "Oila Kodeksi",
    url: "https://lex.uz/docs/99552",
    articles: {
      "14": "Nikoh yoshining pastki chegarasi erkaklar uchun 18 yosh, ayollar uchun 17 yosh.",
      "38": "Ajralish — FUAV (ZAGS) orqali yoki sud orqali amalga oshiriladi.",
      "74": "Alimentlar — bola 18 yoshga to'lguncha to'lanadi. Miqdor: 1 bola uchun daromadning 25%, 2 bola uchun 33%, 3 va undan ko'p uchun 50%.",
      "160": "Meros — turmush o'rtog'i va bolalar birinchi navbatdagi vorislar hisoblanadi.",
    }
  },
  jinoyat: {
    name: "Jinoyat Kodeksi",
    url: "https://lex.uz/docs/111457",
    articles: {
      "168": "O'g'irlik — 3 yilgacha ozodlikdan mahrum qilish.",
      "211": "Firibgarlik — 5 yilgacha ozodlikdan mahrum qilish.",
      "274": "Korrupsiya — 10 yilgacha ozodlikdan mahrum qilish.",
      "118": "Tana jarohati — og'irlik darajasiga qarab 3-10 yil.",
    }
  },
  tadbirkorlik: {
    name: "Tadbirkorlik Qonuni",
    url: "https://lex.uz/docs/3517818",
    articles: {
      "5": "YaTT (Yakka tartibdagi tadbirkor) — davlat ro'yxatidan o'tkazish tartibi: ariza, pasport nusxasi, davlat boji.",
      "12": "MChJ (Mas'uliyati cheklangan jamiyat) — ta'sischilari 1-50 kishi, ustav kapitali kamida 400 ming so'm.",
      "34": "Litsenziya — ayrim faoliyat turlarini litsenziyasiz amalga oshirish taqiqlanadi.",
      "45": "Soliq imtiyozlari — yangi korxonalar dastlabki 3 yil soliq imtiyozlaridan foydalanishi mumkin.",
    }
  }
};

// ── lex.uz dan qonun qidirish funksiyasi ──────────────────
async function searchLexUz(query) {
  try {
    const searchUrl = `https://lex.uz/search?q=${encodeURIComponent(query)}&lang=uz`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'uz,ru;q=0.9'
      },
      timeout: 8000
    });
    
    if (!res.ok) return null;
    const html = await res.text();
    
    // Extract document titles and links from search results
    const results = [];
    const titleRegex = /<a[^>]+href="([^"]*\/docs\/\d+[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    let count = 0;
    
    while ((match = titleRegex.exec(html)) !== null && count < 3) {
      const url = match[1].startsWith('http') ? match[1] : 'https://lex.uz' + match[1];
      const title = match[2].trim();
      if (title.length > 10) {
        results.push({ title, url });
        count++;
      }
    }
    
    return results.length > 0 ? results : null;
  } catch (e) {
    console.log('lex.uz qidiruv xatosi:', e.message);
    return null;
  }
}

// ── Savolga mos qonunlar bazasidan ma'lumot olish ─────────
function getRelevantLaws(query) {
  const q = query.toLowerCase();
  let relevant = [];
  
  const keywords = {
    mehnat: ['mehnat', 'ish', 'xodim', 'maosh', 'ta\'til', 'bo\'shatish', 'ishchi', 'shartnoma', 'ish beruvchi'],
    soliq: ['soliq', 'qqs', 'daromad', 'hisobot', 'imtiyoz', 'stavka', 'to\'lov'],
    fuqarolik: ['shartnoma', 'oldi-sotdi', 'ijara', 'qarz', 'meros', 'mulk', 'sotish', 'sotib'],
    oila: ['nikoh', 'ajralish', 'aliment', 'bola', 'oila', 'er-xotin', 'meros', 'vasiylik'],
    jinoyat: ['jinoyat', 'jazo', 'o\'g\'irlik', 'firibgarlik', 'korrupsiya', 'hibsga', 'sud'],
    tadbirkorlik: ['yatt', 'mchj', 'korxona', 'biznes', 'litsenziya', 'ro\'yxat', 'ustav', 'ta\'sischi']
  };
  
  for (const [key, words] of Object.entries(keywords)) {
    if (words.some(w => q.includes(w))) {
      relevant.push(LAWS_DB[key]);
    }
  }
  
  if (relevant.length === 0) {
    relevant = [LAWS_DB.fuqarolik, LAWS_DB.mehnat];
  }
  
  return relevant;
}

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'HuquqAI server ishlamoqda', 
    time: new Date().toISOString(), 
    provider: process.env.AI_PROVIDER || 'groq',
    lexuz: 'integrated'
  });
});

// ── Qonun qidirish endpoint ───────────────────────────────
app.get('/api/search-law', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q parametri kerak' });
    
    const localResults = getRelevantLaws(q);
    const lexResults = await searchLexUz(q);
    
    res.json({ 
      local: localResults.map(l => ({ name: l.name, url: l.url })),
      lexuz: lexResults || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chat ──────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, mode } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages kerak' });
    
    // Oxirgi foydalanuvchi xabaridan tegishli qonunlarni topish
    const lastMsg = messages[messages.length - 1];
    const query = typeof lastMsg.content === 'string' ? lastMsg.content : '';
    const relevantLaws = getRelevantLaws(query);
    
    // lex.uz dan qo'shimcha qidiruv (asinxron, kutmaymiz)
    let lexContext = '';
    try {
      const lexResults = await Promise.race([
        searchLexUz(query),
        new Promise(resolve => setTimeout(() => resolve(null), 3000))
      ]);
      if (lexResults && lexResults.length > 0) {
        lexContext = '\n\nlex.uz qidiruv natijalari: ' + lexResults.map(r => r.title + ' (' + r.url + ')').join('; ');
      }
    } catch (e) {}
    
    const reply = await callAI(messages, mode || 'umumiy', relevantLaws, lexContext);
    res.json({ reply, lawRefs: relevantLaws.map(l => ({ name: l.name, url: l.url })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Chat with file ────────────────────────────────────────
app.post('/api/chat-with-file', upload.array('files', 5), async (req, res) => {
  try {
    const { message, mode, messagesJson } = req.body;
    const files = req.files || [];
    const messages = JSON.parse(messagesJson || '[]');
    let fileContext = '';
    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        fileContext += '\n\n--- FAYL: ' + file.originalname + ' ---\n' + file.buffer.toString('utf-8').substring(0, 3000) + '\n---';
      }
    }
    const fullMsg = (message || '') + fileContext;
    messages.push({ role: 'user', content: fullMsg });
    const relevantLaws = getRelevantLaws(fullMsg);
    const reply = await callAI(messages, mode || 'umumiy', relevantLaws, '');
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Create doc ────────────────────────────────────────────
app.post('/api/create-doc', async (req, res) => {
  try {
    const { docType, extraInfo, mode } = req.body;
    const prompts = {
      mehnat_shartnoma: "O'zbekiston Mehnat Kodeksi asosida to'liq mehnat shartnomasi shablonini yoz.",
      ijara_shartnoma: "O'zbekiston Fuqarolik Kodeksi asosida ijara shartnomasi shablonini yoz.",
      ishonchnoma: "Notarial ishonchnoma shablonini yoz.",
      ariza: "Rasmiy ariza shablonini yoz.",
      qarz_shartnoma: "Qarz shartnomasi shablonini yoz.",
    };
    const prompt = (prompts[docType] || 'Yuridik hujjat shablonini yoz.') + ' [TO\'LDIRISH KERAK] belgilari qo\'y.' + (extraInfo ? '\nQo\'shimcha: ' + extraInfo : '');
    const relevantLaws = getRelevantLaws(prompt);
    const reply = await callAI([{ role: 'user', content: prompt }], mode || 'umumiy', relevantLaws, '');
    res.json({ document: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── AI chaqiruv ───────────────────────────────────────────
async function callAI(messages, mode, relevantLaws, lexContext) {
  const provider = process.env.AI_PROVIDER || 'groq';
  const sys = buildPrompt(mode, relevantLaws, lexContext);

  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY topilmadi');
    const groqMsgs = messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ 
        model: 'mixtral-8x7b-32768', 
        max_tokens: 4000, 
        temperature: 0.2, 
        messages: [{ role: 'system', content: sys }, ...groqMsgs] 
      })
    });
    const data = await res.json();
    if (data.error) throw new Error('Groq: ' + data.error.message);
    return data.choices[0].message.content;
  }

  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY topilmadi');
    const gemMsgs = messages.map(m => ({ 
      role: m.role === 'assistant' ? 'model' : 'user', 
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] 
    }));
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        system_instruction: { parts: [{ text: sys }] }, 
        contents: gemMsgs, 
        generationConfig: { maxOutputTokens: 4000, temperature: 0.2 } 
      })
    });
    const data = await res.json();
    if (data.error) throw new Error('Gemini: ' + data.error.message);
    return data.candidates[0].content.parts[0].text;
  }

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY topilmadi');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: sys, messages })
    });
    const data = await res.json();
    if (data.error) throw new Error('Anthropic: ' + data.error.message);
    return data.content[0].text;
  }

  throw new Error('Notogri provayder: ' + provider);
}

// ── System prompt ─────────────────────────────────────────
function buildPrompt(mode, relevantLaws, lexContext) {
  const soha = { 
    umumiy: 'Umumiy huquq', mehnat: 'Mehnat huquqi', 
    soliq: 'Soliq huquqi', mulk: 'Mulk huquqi', 
    tadbirkorlik: 'Tadbirkorlik huquqi', oila: 'Oila huquqi', 
    jinoyat: 'Jinoyat huquqi' 
  }[mode] || 'Umumiy huquq';

  let lawsText = '';
  if (relevantLaws && relevantLaws.length > 0) {
    lawsText = '\n\nTEGISHLI QONUNLAR:\n';
    for (const law of relevantLaws) {
      lawsText += '\n' + law.name + ' (' + law.url + '):\n';
      for (const [art, text] of Object.entries(law.articles)) {
        lawsText += '  ' + art + '-modda: ' + text + '\n';
      }
    }
  }

  return "Siz O'zbekiston Respublikasining yuridik maslahatchi AI yordamchisisiz.\n\n" +
    "JORIY SOHA: " + soha + "\n\n" +
    "QOIDALAR:\n" +
    "1. Berilgan savolga TO'LIQ va ANIQ javob bering\n" +
    "2. Quyidagi qonun moddalari asosida javob bering\n" +
    "3. Ustav, shartnoma, hujjat so'ralsa — TO'LIQ shablon bering [TO'LDIRISH KERAK] belgilari bilan\n" +
    "4. Qonun moddasini aniq ko'rsating\n" +
    "5. Amaliy tavsiyalar bering\n" +
    lawsText +
    (lexContext || '') + "\n\n" +
    "O'zbek tilida, professional va to'liq javob bering.";
}

// ── Asosiy sahifa ─────────────────────────────────────────
app.get('*', (req, res) => {
  const p = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(p)) res.sendFile(p);
  else res.json({ message: 'HuquqAI server ishlayapti. public/index.html qoying.' });
});

app.listen(PORT, () => {
  console.log('HuquqAI Server: http://localhost:' + PORT);
  console.log('Provider: ' + (process.env.AI_PROVIDER || 'groq'));
  console.log('lex.uz: integrated');
});
