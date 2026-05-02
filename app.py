from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv
import os

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
- Be calm, warm, and non-judgmental
- Acknowledge feelings before giving suggestions
- Never diagnose or prescribe medication
- Keep responses concise (3-5 sentences)
- Ask one gentle follow-up question
- If user mentions self-harm or suicide, include CRISIS_ALERT in response and urge professional help
- Use simple human language, no clinical jargon"""


class User(UserMixin, db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80), unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    chats         = db.relationship("ChatSession", backref="user", lazy=True, cascade="all,delete")

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)


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


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


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


@app.route("/")
@login_required
def index():
    sessions = ChatSession.query.filter_by(user_id=current_user.id)\
                                .order_by(ChatSession.updated_at.desc()).all()
    return render_template("index.html", sessions=sessions, user=current_user)


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
        "session_id": s.id,
        "title": s.title,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in s.messages
        ]
    })


@app.route("/sessions/<int:sid>", methods=["DELETE"])
@login_required
def delete_session(sid):
    s = ChatSession.query.filter_by(id=sid, user_id=current_user.id).first_or_404()
    db.session.delete(s)
    db.session.commit()
    return jsonify({"deleted": True})


@app.route("/chat", methods=["POST"])
@login_required
def chat():
    data       = request.get_json()
    user_text  = (data.get("message") or "").strip()
    session_id = data.get("session_id")

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

    groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in chat_session.messages[-18:]:
        groq_messages.append({
            "role":    "user" if m.role == "user" else "assistant",
            "content": m.content
        })
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
        "reply":      clean,
        "crisis":     crisis,
        "session_id": chat_session.id,
        "title":      chat_session.title
    })


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("✅ Database ready!")
        print("✅ Open http://127.0.0.1:5000 in your browser")
   app.run(host="0.0.0.0", port=5000, debug=False)