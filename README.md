# 🌿 Serenity v2 — Mental Health Chatbot
### With User Login + Chat History + Mobile UI

---

## 📁 Project Structure

```
serenity-v2/
├── app.py                    ← Flask backend (routes, DB, API calls)
├── requirements.txt          ← Python packages
├── .env                      ← API key + secret key (never commit)
├── .gitignore
├── templates/
│   ├── auth.html             ← Login & Register page
│   └── index.html            ← Main chat UI
└── static/
    ├── css/style.css         ← All styles (desktop + mobile)
    └── js/chat.js            ← Frontend logic
```

---

## 🚀 Run on Your Laptop (Step by Step)

### 1. Open terminal in the project folder
```bash
cd serenity-v2
```

### 2. Create virtual environment
```bash
python -m venv venv
```

### 3. Activate virtual environment
```bash
# Windows CMD:
venv\Scripts\activate

# Windows PowerShell:
venv\Scripts\Activate.ps1

# Mac / Linux:
source venv/bin/activate
```
You'll see `(venv)` in your terminal ✅

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Add your keys in .env
Open `.env` and fill in:
```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
SECRET_KEY=any-random-string-like-abc123xyz
```
Get Anthropic key at: https://console.anthropic.com/api-keys

### 6. Run the app
```bash
python app.py
```
Expected output:
```
✅ Database ready (serenity.db)
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

### 7. Open in browser
```
http://localhost:5000
```

---

## 📱 Features

| Feature | Details |
|---|---|
| User registration & login | Username + email + hashed password (bcrypt) |
| Chat history | All conversations saved in SQLite DB |
| Multiple sessions | Create, switch, delete conversations |
| Auto-titled chats | First message becomes the chat title |
| Mobile responsive | Full sidebar + hamburger menu on phone |
| Crisis detection | Auto-shows helpline banner |
| Secure API key | Key stays on server, never sent to browser |

---

## 🗄️ Database (SQLite — auto created)

Three tables created automatically on first run:
- `user` — stores username, email, hashed password
- `chat_session` — stores each conversation with title + timestamps
- `message` — stores every message (role + content + timestamp)

The file `serenity.db` is created in your project folder.

---

## ⚠️ Common Errors

| Error | Fix |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` with venv active |
| `AuthenticationError` | Check ANTHROPIC_API_KEY in .env |
| Port 5000 in use | Change `port=5000` to `port=8080` in app.py |
| PowerShell execution policy | Run: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `python` not found | Try `python3` instead |

---

## 🌐 Deploy Free Online (Render.com)

1. Push to GitHub (make sure `.env` is in `.gitignore`!)
2. Go to https://render.com → New Web Service
3. Connect GitHub repo
4. Set environment variables:
   - `ANTHROPIC_API_KEY` = your key
   - `SECRET_KEY` = any random string
5. Build command: `pip install -r requirements.txt`
6. Start command: `python app.py`
7. Done — you get a public URL! 🎉
