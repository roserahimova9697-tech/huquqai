# ⚖️ HuquqAI Backend Server

O'zbekiston Qonunchiligiga Asoslangan AI Yuridik Maslahat Tizimi

---

## 📁 FAYL TUZILMASI

```
huquqai-backend/
├── server.js          ← Asosiy server kodi
├── package.json       ← Kutubxonalar ro'yxati
├── .env               ← API kalitlar (maxfiy!)
├── .gitignore         ← Git ga yuklanmaydigan fayllar
├── README.md          ← Ushbu fayl
└── public/
    └── index.html     ← Frontend (sayt)
```

---

## 🚀 ISHGA TUSHIRISH (3 QADAM)

### 1-QADAM: Node.js o'rnatish
- https://nodejs.org ga kiring
- "LTS" versiyasini yuklab o'rnating
- Terminal oching va tekshiring:
  ```
  node --version
  npm --version
  ```

### 2-QADAM: Kutubxonalarni o'rnatish
Terminal da papkaga kiring:
```bash
cd huquqai-backend
npm install
```

### 3-QADAM: API kalitni sozlash
`.env` faylini oching va kalitni yozing:

**Groq (bepul):**
```
AI_PROVIDER=groq
GROQ_API_KEY=gsk_bu_yerga_haqiqiy_kalitingizni_yozing
```

Kalitni olish: https://console.groq.com → API Keys → Create

### Serverni ishga tushirish:
```bash
npm start
```

Muvaffaqiyatli bo'lsa:
```
╔════════════════════════════════════╗
║   ⚖️  HuquqAI Server Ishlamoqda   ║
║   🌐 http://localhost:3000         ║
╚════════════════════════════════════╝
```

Brauzerda oching: http://localhost:3000

---

## 🌐 VERCEL GA JOYLASH (BEPUL HOSTING)

### 1. GitHub ga yuklash
```bash
git init
git add .
git commit -m "HuquqAI backend"
```
GitHub.com da yangi repository yarating va yuklang.

### 2. Vercel ga ulash
1. https://vercel.com ga kiring
2. GitHub bilan kirish
3. "New Project" → repository tanlang
4. **Environment Variables** qo'shish:
   - `AI_PROVIDER` = `groq`
   - `GROQ_API_KEY` = `gsk_...`
5. Deploy bosing!

### 3. vercel.json fayl qo'shing:
```json
{
  "version": 2,
  "builds": [{"src": "server.js", "use": "@vercel/node"}],
  "routes": [{"src": "/(.*)", "dest": "/server.js"}]
}
```

---

## 🔌 API ENDPOINTLAR

| Method | URL | Vazifa |
|--------|-----|--------|
| GET | /api/health | Server tekshirish |
| POST | /api/chat | AI ga savol |
| POST | /api/chat-with-file | Fayl bilan savol |
| POST | /api/create-doc | Hujjat yaratish |

---

## 🔒 XAVFSIZLIK

- `.env` faylini hech kimga bermang
- `.env` GitHub ga yuklanmaydi (.gitignore da)
- API kalitlar faqat serverda saqlanadi
- Foydalanuvchilar kalitni ko'ra olmaydi

---

## 🆘 YORDAM

Muammo bo'lsa:
1. `node --version` — 18+ bo'lishi kerak
2. `.env` faylida kalit to'g'ri yozilganmi?
3. Port 3000 band emasmi? `PORT=3001` deb o'zgartiring
