// ── State ──────────────────────────────────────────────────────────────────
let currentSessionId = null;
let isTyping         = false;

const CRISIS_KEYWORDS = [
  'want to die','end it','kill myself','hurt myself',
  "can't go on",'no point living','suicid','self harm','harm myself'
];

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const firstSession = document.querySelector('.session-item');
  if (firstSession) {
    const sid = parseInt(firstSession.id.replace('sess-', ''));
    loadSession(sid);
  } else {
    showEmptyState();
  }
  document.getElementById('userInput').focus();
});

// ── Sidebar (mobile) ───────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ── Session management ─────────────────────────────────────────────────────
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

  if (data.messages.length === 0) {
    showEmptyState();
    return;
  }

  // Render existing messages
  data.messages.forEach(m => {
    renderMessage(m.role === 'assistant' ? 'bot' : 'user', m.content,
                  [], m.created_at ? formatTime(m.created_at) : null);
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

  if (currentSessionId === sid) {
    currentSessionId = null;
    clearMessages();
    showEmptyState();
  }

  if (!document.querySelector('.session-item')) {
    document.getElementById('sessionList').innerHTML =
      '<p class="no-sessions">No chats yet.<br/>Start a new conversation!</p>';
  }
}

function addSidebarItem(sid, title) {
  const list    = document.getElementById('sessionList');
  const noSess  = list.querySelector('.no-sessions');
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

// ── Message rendering ──────────────────────────────────────────────────────
function clearMessages() {
  document.getElementById('messages').innerHTML = '';
  document.getElementById('crisisBanner').classList.remove('show');
}

function showEmptyState() {
  const msgs = document.getElementById('messages');
  msgs.innerHTML = `
    <div class="empty-state">
      <div class="big-icon">🌿</div>
      <h2>Hey, I'm Serenity</h2>
      <p>This is a safe, judgment-free space. What's been on your mind lately?</p>
    </div>`;
}

function renderMessage(role, text, chips = [], timeStr = null) {
  const msgs = document.getElementById('messages');

  // Remove empty state if present
  const empty = msgs.querySelector('.empty-state');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = 'msg-row ' + role;

  const av  = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = role === 'bot' ? '🌿' : 'You';

  const wrap = document.createElement('div');
 wrap.style.display   = 'flex';
wrap.style.flexDirection = 'column';
wrap.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';
wrap.style.maxWidth = '72%';

  const bub = document.createElement('div');
  bub.className   = 'bubble';
  bub.textContent = text;

  if (chips.length) {
    const chipRow = document.createElement('div');
    chipRow.className = 'mood-row';
    chips.forEach(c => {
      const btn = document.createElement('button');
      btn.className   = 'mood-btn';
      btn.textContent = c;
      btn.onclick     = () => quickSend(c);
      chipRow.appendChild(btn);
    });
    bub.appendChild(chipRow);
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
}

function showTyping() {
  const msgs = document.getElementById('messages');
  const row  = document.createElement('div');
  row.className = 'msg-row bot';
  row.id        = 'typingIndicator';

  const av = document.createElement('div');
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

// ── Send message ───────────────────────────────────────────────────────────
async function sendMessage() {
  if (isTyping) return;

  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  const now = formatTime(new Date().toISOString());
  renderMessage('user', text, [], now);

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
      body:    JSON.stringify({ message: text, session_id: currentSessionId })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    removeTyping();

    if (data.crisis) {
      document.getElementById('crisisBanner').classList.add('show');
    }

    // Update session
    currentSessionId = data.session_id;
    updateSidebarTitle(data.session_id, data.title);
    setActiveSession(data.session_id);

    renderMessage('bot', data.reply, [], formatTime(new Date().toISOString()));
    scrollBottom();

  } catch (err) {
    removeTyping();
    renderMessage('bot', `Something went wrong: ${err.message}\n\nCheck the terminal for details. 💙`);
    scrollBottom();
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function isCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(k => lower.includes(k));
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
