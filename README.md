# 🌿 Serenity — Mental Health Chatbot

An AI-powered mental health support chatbot built with Python Flask + Groq AI.

---

## 📁 Project Structure

```
serenity/
├── app.py                    ← Flask backend
├── requirements.txt          ← Python packages
├── .env                      ← API keys (never commit this!)
├── templates/
│   ├── auth.html             ← Login & Register page
│   └── index.html            ← Main chat UI
└── static/
    ├── css/style.css         ← Styles
    └── js/chat.js            ← Frontend logic
```

---

## 🚀 Run Locally

### 1. Clone the repo
```bash
git clone https://github.com/apoorv1jha/serenity.git
cd serenity
```

### 2. Create virtual environment
```bash
python -m venv venv
```

### 3. Activate virtual environment
```bash
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Add your keys in .env
Create a `.env` file and fill in:
```
GROQ_API_KEY=gsk_your_groq_key_here
SECRET_KEY=any-random-string-like-abc123xyz
```

Get your FREE Groq key at: https://console.groq.com

### 6. Run the app
```bash
python app.py
```

Expected output:
```
✅ Database ready!
✅ Open http://127.0.0.1:5000 in your browser
```

---

## 🌐 Live Demo
https://serenity-dmtt.onrender.com

---

## ✨ Features
- 🔐 User login & registration
- 💬 AI-powered mental health support (Groq + LLaMA)
- 🗂️ Chat history saved per user
- 📱 Mobile responsive UI
- 🆘 Crisis detection with helpline numbers
- 🔒 Secure — API key never exposed to users

---

## 🛠️ Tech Stack
- **Backend:** Python, Flask, SQLAlchemy, Flask-Login
- **AI:** Groq API (LLaMA 3.1)
- **Database:** SQLite
- **Frontend:** HTML, CSS, JavaScript
- **Deployment:** Render.com