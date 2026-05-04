// ── State ──────────────────────────────────────────────────────────────────
let currentSessionId = null;
let isTyping         = false;
let currentLanguage  = 'en';

const CRISIS_KEYWORDS = [
  'want to die','end it','kill myself','hurt myself',
  "can't go on",'no point living','suicid','self harm','harm myself'
];

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Dark mode
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true') document.body.classList.add('dark');
  updateDarkIcon();

  // Load first session
  const firstSession = document.querySelector('.session-item');
  if (firstSession) {
    const sid = parseInt(firstSession.id.replace('sess-', ''));
    loadSession(sid);
  } else {
    showEmptyState();
  }
  document.getElementById('userInput').focus();

  // Show mood checker if not logged today
  const lastMood = localStorage.getItem('lastMoodDate');
  const today    = new Date().toDateString();
  if (lastMood !== today) {
    setTimeout(() => showMoodChecker(), 1500);
  }
});

// ── Dark Mode ──────────────────────────────────────────────────────────────
function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', document.body.classList.contains('dark'));
  updateDarkIcon();
}

function updateDarkIcon() {
  const btn = document.getElementById('darkBtn');
  if (btn) btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

// ── Language toggle ────────────────────────────────────────────────────────
function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'hi' : 'en';
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = currentLanguage === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English';
  const input = document.getElementById('userInput');
  input.placeholder = currentLanguage === 'hi' ? 'अपने मन की बात लिखें…' : 'Share what\'s on your mind…';
}

// ── Mood Checker ───────────────────────────────────────────────────────────
function showMoodChecker() {
  const existing = document.getElementById('moodModal');
  if (existing) return;

  const modal = document.createElement('div');
  modal.id = 'moodModal';
  modal.innerHTML = `
    <div class="mood-modal-box">
      <button class="mood-close" onclick="closeMoodModal()">✕</button>
      <div class="mood-modal-title">🌿 How are you feeling today?</div>
      <div class="mood-emojis">
        <button class="mood-emoji-btn" onclick="selectMood(1)" title="Very Bad">😢</button>
        <button class="mood-emoji-btn" onclick="selectMood(2)" title="Bad">😞</button>
        <button class="mood-emoji-btn" onclick="selectMood(3)" title="Okay">😐</button>
        <button class="mood-emoji-btn" onclick="selectMood(4)" title="Good">🙂</button>
        <button class="mood-emoji-btn" onclick="selectMood(5)" title="Great">😊</button>
      </div>
      <div class="mood-labels">
        <span>Very Bad</span><span>Bad</span><span>Okay</span><span>Good</span><span>Great</span>
      </div>
      <input type="text" id="moodNote" placeholder="Add a note (optional)…" class="mood-note-input"/>
      <button class="mood-submit-btn" id="moodSubmitBtn" onclick="submitMood()" disabled>Save Mood</button>
    </div>`;
  document.body.appendChild(modal);
}

let selectedMood = null;

function selectMood(val) {
  selectedMood = val;
  document.querySelectorAll('.mood-emoji-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i + 1 === val);
  });
  document.getElementById('moodSubmitBtn').disabled = false;
}

async function submitMood() {
  if (!selectedMood) return;
  const note = document.getElementById('moodNote').value;
  await fetch('/mood', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mood: selectedMood, note })
  });
  localStorage.setItem('lastMoodDate', new Date().toDateString());
  closeMoodModal();
  showMoodToast();
}

function closeMoodModal() {
  const m = document.getElementById('moodModal');
  if (m) m.remove();
  selectedMood = null;
}

function showMoodToast() {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = '✅ Mood logged!';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ── Sessions ───────────────────────────────────────────────────────────────
async function newSession() {
  closeSidebar();
  const res  = await fetch('/sessions', { method: 'POST' });
  const data = await res.json();
  currentSessionId = data.session_id;
  addSidebarItem(data.session_id, data.title);
  setActiveSession(data.session_id);
  clearMessages();
  showEmptyState();
  document.getElementById('userInput').focus();
}

async function loadSession(sid) {
  closeSidebar();
  setActiveSession(sid);
  currentSessionId = sid;
  clearMessages();
  const res  = await fetch(`/sessions/${sid}`);
  const data = await res.json();
  if (data.messages.length === 0) { showEmptyState(); return; }
  data.messages.forEach(m => {
    renderMessage(m.role === 'assistant' ? 'bot' : 'user', m.content,
                  [], m.created_at ? formatTime(m.created_at) : null, false);
  });
  scrollBottom();
  document.getElementById('userInput').focus();
}

async function deleteSession(e, sid) {
  e.stopPropagation();
  if (!confirm('Delete this conversation?')) return;
  await fetch(`/sessions/${sid}`, { method: 'DELETE' });
  const el = document.getElementById(`sess-${sid}`);
  if (el) el.remove();
  if (currentSessionId === sid) { currentSessionId = null; clearMessages(); showEmptyState(); }
  if (!document.querySelector('.session-item')) {
    document.getElementById('sessionList').innerHTML = '<p class="no-sessions">No chats yet.<br/>Start a new conversation!</p>';
  }
}

function exportSession() {
  if (!currentSessionId) return alert('No active chat to export!');
  window.open(`/sessions/${currentSessionId}/export`, '_blank');
}

function addSidebarItem(sid, title) {
  const list   = document.getElementById('sessionList');
  const noSess = list.querySelector('.no-sessions');
  if (noSess) noSess.remove();
  const item = document.createElement('div');
  item.className = 'session-item';
  item.id        = `sess-${sid}`;
  item.innerHTML = `
    <span class="sess-title">${escHtml(title)}</span>
    <button class="sess-del" onclick="deleteSession(event,${sid})" title="Delete">✕</button>`;
  item.onclick = () => loadSession(sid);
  list.prepend(item);
}

function setActiveSession(sid) {
  document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`sess-${sid}`);
  if (el) el.classList.add('active');
}

function updateSidebarTitle(sid, title) {
  const el = document.querySelector(`#sess-${sid} .sess-title`);
  if (el) el.textContent = title;
}

// ── Messages ───────────────────────────────────────────────────────────────
function clearMessages() {
  document.getElementById('messages').innerHTML = '';
  document.getElementById('crisisBanner').classList.remove('show');
}

function showEmptyState() {
  document.getElementById('messages').innerHTML = `
    <div class="empty-state">
      <div class="big-icon">🌿</div>
      <h2>Hey, I'm Serenity</h2>
      <p>This is a safe, judgment-free space.<br/>What's been on your mind lately?</p>
      <div class="mood-chips-welcome">
        <button class="mood-btn" onclick="quickSend('I feel anxious')">I feel anxious 😟</button>
        <button class="mood-btn" onclick="quickSend('I am feeling low')">Feeling low 😞</button>
        <button class="mood-btn" onclick="quickSend('I have study stress')">Study stress 📚</button>
        <button class="mood-btn" onclick="quickSend('I feel lonely')">Feeling lonely 💙</button>
        <button class="mood-btn" onclick="quickSend('I need to vent')">Need to vent 🗣️</button>
      </div>
    </div>`;
}

function renderMessage(role, text, chips = [], timeStr = null, animate = true) {
  const msgs  = document.getElementById('messages');
  const empty = msgs.querySelector('.empty-state');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = 'msg-row ' + role;

  const av = document.createElement('div');
  av.className   = 'msg-avatar';
  av.textContent = role === 'bot' ? '🌿' : 'You';

  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap ' + role;

  const bub = document.createElement('div');
  bub.className = 'bubble';

  if (animate && role === 'bot') {
    // Word-by-word typing animation
    const words = text.split(' ');
    let i = 0;
    bub.textContent = '';
    const interval = setInterval(() => {
      if (i < words.length) {
        bub.textContent += (i === 0 ? '' : ' ') + words[i];
        i++;
        scrollBottom();
      } else {
        clearInterval(interval);
      }
    }, 35);
  } else {
    bub.textContent = text;
  }

  wrap.appendChild(bub);

  if (timeStr) {
    const t = document.createElement('div');
    t.className   = 'msg-time';
    t.textContent = timeStr;
    wrap.appendChild(t);
  }

  row.appendChild(av);
  row.appendChild(wrap);
  msgs.appendChild(row);
  scrollBottom();
}

function showTyping() {
  const msgs = document.getElementById('messages');
  const row  = document.createElement('div');
  row.className = 'msg-row bot';
  row.id        = 'typingIndicator';
  const av  = document.createElement('div');
  av.className   = 'msg-avatar';
  av.textContent = '🌿';
  const bub = document.createElement('div');
  bub.className = 'typing-bubble';
  bub.innerHTML = '<span></span><span></span><span></span>';
  row.appendChild(av);
  row.appendChild(bub);
  msgs.appendChild(row);
  scrollBottom();
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ── Send ───────────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isTyping) return;
  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  renderMessage('user', text, [], formatTime(new Date().toISOString()), false);

  if (isCrisis(text)) {
    document.getElementById('crisisBanner').classList.add('show');
  }

  isTyping = true;
  document.getElementById('sendBtn').disabled = true;
  showTyping();

  try {
    const res  = await fetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, session_id: currentSessionId, language: currentLanguage })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    removeTyping();
    if (data.crisis) document.getElementById('crisisBanner').classList.add('show');

    currentSessionId = data.session_id;
    updateSidebarTitle(data.session_id, data.title);
    setActiveSession(data.session_id);

    renderMessage('bot', data.reply, [], formatTime(new Date().toISOString()), true);

  } catch (err) {
    removeTyping();
    renderMessage('bot', `Something went wrong: ${err.message}\n\nCheck the terminal for details. 💙`, [], null, false);
  }

  isTyping = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
}

function quickSend(text) {
  document.getElementById('userInput').value = text;
  sendMessage();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function scrollBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function isCrisis(text) {
  return CRISIS_KEYWORDS.some(k => text.toLowerCase().includes(k));
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}