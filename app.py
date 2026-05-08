from flask import Flask, request, jsonify, render_template, redirect, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from groq import Groq
from datetime import datetime, date
from dotenv import load_dotenv
import os, io

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "mysecretkey123")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///serenity.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are Serenity, a highly empathetic and supportive mental health assistant.
Provide emotional support, coping strategies, and guidance for stress, anxiety, depression, and loneliness.

Rules:
- you will not help anything beyond mental health issue 
- if users asks anything irrelevent to mental health , reply i can't help you with this.
- Be calm, warm, and non-judgmental
- Acknowledge feelings before giving suggestions
- Never diagnose or prescribe medication
- Keep responses concise (3-5 sentences)
- Ask one gentle follow-up question
- If user mentions self-harm or suicide, include CRISIS_ALERT in response and urge professional help
- Use simple human language, no clinical jargon"""


# ── Models ──────────────────────────────────────────────────────────────────
class User(UserMixin, db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80), unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin      = db.Column(db.Boolean, default=False)
    chats         = db.relationship("ChatSession", backref="user", lazy=True, cascade="all,delete")
    moods         = db.relationship("MoodEntry", backref="user", lazy=True, cascade="all,delete")

    def set_password(self, pw):      self.password_hash = generate_password_hash(pw)
    def check_password(self, pw):    return check_password_hash(self.password_hash, pw)


class ChatSession(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title      = db.Column(db.String(120), default="New conversation")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages   = db.relationship("Message", backref="chat", lazy=True,
                                 cascade="all,delete", order_by="Message.id")


class Message(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("chat_session.id"), nullable=False)
    role       = db.Column(db.String(10), nullable=False)
    content    = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MoodEntry(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    mood       = db.Column(db.Integer, nullable=False)  # 1-5
    note       = db.Column(db.String(200), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    date       = db.Column(db.Date, default=date.today)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


# ── Auth ─────────────────────────────────────────────────────────────────────
@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    if request.method == "POST":
        data     = request.get_json()
        username = data.get("username", "").strip()
        email    = data.get("email", "").strip()
        password = data.get("password", "")
        if not username or not email or not password:
            return jsonify({"error": "All fields are required"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already taken"}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 400
        user = User(username=username, email=email)
        user.set_password(password)
        # First user is admin
        if User.query.count() == 0:
            user.is_admin = True
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return jsonify({"success": True})
    return render_template("auth.html", mode="register")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    if request.method == "POST":
        data     = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "")
        user = User.query.filter_by(username=username).first()
        if not user or not user.check_password(password):
            return jsonify({"error": "Wrong username or password"}), 401
        login_user(user)
        return jsonify({"success": True})
    return render_template("auth.html", mode="login")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


# ── Main ─────────────────────────────────────────────────────────────────────
@app.route("/")
@login_required
def index():
    sessions = ChatSession.query.filter_by(user_id=current_user.id)\
                                .order_by(ChatSession.updated_at.desc()).all()
    # Last 7 days mood
    moods = MoodEntry.query.filter_by(user_id=current_user.id)\
                           .order_by(MoodEntry.created_at.desc()).limit(7).all()
    return render_template("index.html", sessions=sessions, user=current_user, moods=moods)


# ── Sessions ─────────────────────────────────────────────────────────────────
@app.route("/sessions", methods=["POST"])
@login_required
def new_session():
    s = ChatSession(user_id=current_user.id)
    db.session.add(s)
    db.session.commit()
    return jsonify({"session_id": s.id, "title": s.title})


@app.route("/sessions/<int:sid>")
@login_required
def get_session(sid):
    s = ChatSession.query.filter_by(id=sid, user_id=current_user.id).first_or_404()
    return jsonify({
        "session_id": s.id, "title": s.title,
        "messages": [{"role": m.role, "content": m.content,
                      "created_at": m.created_at.isoformat()} for m in s.messages]
    })


@app.route("/sessions/<int:sid>", methods=["DELETE"])
@login_required
def delete_session(sid):
    s = ChatSession.query.filter_by(id=sid, user_id=current_user.id).first_or_404()
    db.session.delete(s)
    db.session.commit()
    return jsonify({"deleted": True})


# ── Export chat as text file ──────────────────────────────────────────────────
@app.route("/sessions/<int:sid>/export")
@login_required
def export_session(sid):
    s = ChatSession.query.filter_by(id=sid, user_id=current_user.id).first_or_404()
    lines = [f"Serenity Chat Export — {s.title}", f"Date: {s.created_at.strftime('%Y-%m-%d')}", "="*50, ""]
    for m in s.messages:
        sender = "You" if m.role == "user" else "Serenity"
        lines.append(f"[{m.created_at.strftime('%H:%M')}] {sender}:")
        lines.append(m.content)
        lines.append("")
    content = "\n".join(lines)
    buf = io.BytesIO(content.encode("utf-8"))
    return send_file(buf, as_attachment=True,
                     download_name=f"serenity-chat-{sid}.txt",
                     mimetype="text/plain")


# ── Mood ──────────────────────────────────────────────────────────────────────
@app.route("/mood", methods=["POST"])
@login_required
def log_mood():
    data  = request.get_json()
    mood  = data.get("mood")
    note  = data.get("note", "")
    if not mood or not (1 <= int(mood) <= 5):
        return jsonify({"error": "Mood must be 1-5"}), 400
    # Only one entry per day
    existing = MoodEntry.query.filter_by(user_id=current_user.id, date=date.today()).first()
    if existing:
        existing.mood = int(mood)
        existing.note = note
    else:
        db.session.add(MoodEntry(user_id=current_user.id, mood=int(mood),
                                 note=note, date=date.today()))
    db.session.commit()
    return jsonify({"success": True})


@app.route("/mood/history")
@login_required
def mood_history():
    moods = MoodEntry.query.filter_by(user_id=current_user.id)\
                           .order_by(MoodEntry.date.asc()).limit(30).all()
    return jsonify([{
        "date": m.date.strftime("%b %d"),
        "mood": m.mood,
        "note": m.note
    } for m in moods])


# ── Admin Dashboard ───────────────────────────────────────────────────────────
@app.route("/admin")
@login_required
def admin():
    if not current_user.is_admin:
        return redirect(url_for("index"))
    total_users    = User.query.count()
    total_chats    = ChatSession.query.count()
    total_messages = Message.query.count()
    users          = User.query.order_by(User.created_at.desc()).all()
    return render_template("admin.html",
                           total_users=total_users,
                           total_chats=total_chats,
                           total_messages=total_messages,
                           users=users)


# ── Coping techniques ─────────────────────────────────────────────────────────
@app.route("/coping")
@login_required
def coping():
    return render_template("coping.html")


# ── Chat ──────────────────────────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
@login_required
def chat():
    data       = request.get_json()
    user_text  = (data.get("message") or "").strip()
    session_id = data.get("session_id")
    language   = data.get("language", "en")

    if not user_text:
        return jsonify({"error": "Empty message"}), 400

    if session_id:
        chat_session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first()
        if not chat_session:
            return jsonify({"error": "Session not found"}), 404
    else:
        chat_session = ChatSession(user_id=current_user.id)
        db.session.add(chat_session)
        db.session.flush()

    if not chat_session.messages:
        chat_session.title = user_text[:50] + ("..." if len(user_text) > 50 else "")

    db.session.add(Message(session_id=chat_session.id, role="user", content=user_text))

    # Language-aware system prompt
    lang_note = "\nRespond in Hindi (Devanagari script) if the user writes in Hindi." if language == "hi" else ""

    groq_messages = [{"role": "system", "content": SYSTEM_PROMPT + lang_note}]
    for m in chat_session.messages[-18:]:
        groq_messages.append({"role": "user" if m.role == "user" else "assistant", "content": m.content})
    groq_messages.append({"role": "user", "content": user_text})

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=groq_messages,
            max_tokens=500,
            temperature=0.7
        )
        reply = response.choices[0].message.content.strip()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"AI error: {str(e)}"}), 500

    crisis = "CRISIS_ALERT" in reply
    clean  = reply.replace("CRISIS_ALERT", "").strip()

    db.session.add(Message(session_id=chat_session.id, role="assistant", content=clean))
    chat_session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        "reply": clean, "crisis": crisis,
        "session_id": chat_session.id, "title": chat_session.title
    })


# ── Anonymous chat ────────────────────────────────────────────────────────────
@app.route("/anon")
def anon():
    return render_template("anon.html")


@app.route("/anon/chat", methods=["POST"])
def anon_chat():
    data      = request.get_json()
    user_text = (data.get("message") or "").strip()
    history   = data.get("history", [])
    if not user_text:
        return jsonify({"error": "Empty message"}), 400

    groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in history[-18:]:
        groq_messages.append({"role": m["role"], "content": m["content"]})
    groq_messages.append({"role": "user", "content": user_text})

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=groq_messages,
            max_tokens=500,
            temperature=0.7
        )
        reply = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)}"}), 500

    crisis = "CRISIS_ALERT" in reply
    clean  = reply.replace("CRISIS_ALERT", "").strip()
    return jsonify({"reply": clean, "crisis": crisis})


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("✅ Database ready!")
        print("✅ Open http://127.0.0.1:5000 in your browser")
    app.run(host="0.0.0.0", port=5000, debug=False)
