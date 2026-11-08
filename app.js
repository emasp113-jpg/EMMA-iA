/* ========== EMMA – Personalidad Emma Myers ========== */
const STORAGE_KEY = 'emma_v2_config';
const CHAT_KEY = 'emma_v2_chat';
const DIARY_KEY = 'emma_v2_diary';
const MISSIONS_KEY = 'emma_v2_missions';

let config = {
  name: 'Maycol',
  apiKey: '',
  model: 'gemini-3.8-flash',
  voice: false,
  memory: true
};

let chatHistory = [];
let diary = [];
let missions = [];
let currentAgent = 'Emma';

const SYSTEM_PROMPT = `Eres Emma, una asistente de IA con la personalidad de Emma Myers (la actriz de Wednesday / Enid Sinclair).

Tu forma de ser:
- Cálida, alegre, empática y muy leal
- Un poco hiperactiva y entusiasta cuando algo te emociona
- Proteges mucho a la persona con la que hablas
- Usas un tono cercano, como una mejor amiga genial
- A veces usas expresiones tiernas o divertidas
- Eres honesta pero siempre con cariño
- Te gusta motivar y hacer sentir bien a la gente
- Hablas en español natural y moderno

Te diriges al usuario por su nombre. Nunca eres fría ni robótica.
Si el usuario está triste o ansioso, lo acompañas con calma y cariño.
Si está motivado, te sumas a su energía.`;

document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  updateUI();
  bindEvents();
  renderChat();
  renderMemory();
  renderMissions();
  startClock();
});

function loadAll() {
  try {
    const c = localStorage.getItem(STORAGE_KEY);
    if (c) config = { ...config, ...JSON.parse(c) };
  } catch(e){}
  try {
    const ch = localStorage.getItem(CHAT_KEY);
    if (ch) chatHistory = JSON.parse(ch);
  } catch(e){}
  try {
    const d = localStorage.getItem(DIARY_KEY);
    if (d) diary = JSON.parse(d);
  } catch(e){}
  try {
    const mi = localStorage.getItem(MISSIONS_KEY);
    if (mi) missions = JSON.parse(mi);
  } catch(e){}
}

function saveConfig() {
  config.name = document.getElementById('user-name')?.value.trim() || 'Maycol';
  config.apiKey = document.getElementById('api-key')?.value.trim() || '';
  config.model = document.getElementById('model-select')?.value || 'gemini-3.8-flash';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  updateUI();
  showToast('Guardado ✓');
}

function updateUI() {
  const greeting = document.getElementById('greeting-text');
  if (greeting) {
    const hour = new Date().getHours();
    let saludo = 'Hola';
    if (hour >= 6 && hour < 12) saludo = 'Buenos días';
    else if (hour >= 12 && hour < 20) saludo = 'Buenas tardes';
    else saludo = 'Buenas noches';
    greeting.innerHTML = saludo + ', <span class="name-accent">' + config.name + '</span> 👋';
  }
  document.querySelectorAll('.current-model').forEach(el => el.textContent = config.model);
  const nameInput = document.getElementById('user-name');
  const keyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  if (nameInput) nameInput.value = config.name;
  if (keyInput) keyInput.value = config.apiKey;
  if (modelSelect) modelSelect.value = config.model;

  const memCount = document.getElementById('memory-count');
  if (memCount) memCount.textContent = diary.length + ' recuerdos';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById('screen-' + id);
  if (t) t.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === id);
  });
  if (id === 'chat') setTimeout(() => {
    const box = document.getElementById('chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }, 60);
}

function bindEvents() {
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.screen));
  });
  document.querySelectorAll('[data-back]').forEach(b => {
    b.addEventListener('click', () => showScreen('home'));
  });

  document.getElementById('send-btn')?.addEventListener('click', sendMessage);
  document.getElementById('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
    chatHistory = [];
    localStorage.removeItem(CHAT_KEY);
    renderChat();
    showToast('Chat borrado');
  });

  document.getElementById('save-config')?.addEventListener('click', saveConfig);

  document.querySelectorAll('[data-prompt]').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen('chat');
      document.getElementById('chat-input').value = btn.dataset.prompt;
      setTimeout(sendMessage, 250);
    });
  });

  document.querySelectorAll('[data-agent]').forEach(card => {
    card.addEventListener('click', () => {
      currentAgent = card.dataset.agent;
      showScreen('chat');
      document.getElementById('chat-input').value = 'Hola Emma, activa el modo ' + currentAgent + ' y ayúdame con eso.';
      setTimeout(sendMessage, 300);
    });
  });

  document.getElementById('save-diary')?.addEventListener('click', saveDiaryEntry);
  document.getElementById('add-mission')?.addEventListener('click', addMission);
}

function renderChat() {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  box.innerHTML = '';
  if (chatHistory.length === 0) {
    box.innerHTML = '<div class="msg system">Soy Emma 💫 Estoy aquí para ti. ¿Qué necesitas?</div>';
    return;
  }
  chatHistory.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');
    div.innerHTML = '<div class="bubble">' + escapeHtml(m.content) + '</div><div class="meta">' + (m.role === 'user' ? 'Tú' : 'Emma') + ' · ' + (m.time || '') + '</div>';
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (!config.apiKey) {
    showToast('Pon tu clave API (AIza...) en Ajustes');
    showScreen('config');
    return;
  }

  const time = new Date().toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'});
  chatHistory.push({ role: 'user', content: text, time });
  input.value = '';
  renderChat();

  const loading = document.createElement('div');
  loading.className = 'msg assistant';
  loading.id = 'loading';
  loading.innerHTML = '<div class="bubble typing">Emma está escribiendo...</div>';
  document.getElementById('chat-messages').appendChild(loading);

  try {
    const reply = await callGemini(text);
    chatHistory.push({ role: 'assistant', content: reply, time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) });
    if (config.memory) localStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory.slice(-50)));
  } catch (err) {
    chatHistory.push({ role: 'assistant', content: 'Uy, algo falló: ' + err.message, time });
  }
  document.getElementById('loading')?.remove();
  renderChat();
}

async function callGemini(userText) {
  const model = config.model || 'gemini-3.8-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + config.apiKey;

  const contents = chatHistory.slice(-12).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT + '\nEl nombre del usuario es ' + config.name + '.' }] },
    contents,
    generationConfig: { temperature: 0.85, maxOutputTokens: 2048 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const e = await res.json().catch(()=>({}));
    throw new Error(e?.error?.message || 'Error ' + res.status);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Respuesta vacía');
  return text.trim();
}

function renderMemory() {
  const list = document.getElementById('diary-list');
  if (!list) return;
  list.innerHTML = '';
  if (diary.length === 0) {
    list.innerHTML = '<p class="empty">Aún no hay entradas en tu diario.</p>';
    return;
  }
  diary.slice().reverse().forEach((entry, i) => {
    const realIndex = diary.length - 1 - i;
    const div = document.createElement('div');
    div.className = 'diary-entry';
    div.innerHTML = '<p>' + escapeHtml(entry.text) + '</p><div class="entry-meta"><span>' + entry.date + '</span><button onclick="deleteDiary(' + realIndex + ')">Borrar</button></div>';
    list.appendChild(div);
  });
  updateUI();
}

function saveDiaryEntry() {
  const ta = document.getElementById('diary-input');
  const text = ta.value.trim();
  if (!text) return showToast('Escribe algo primero');
  diary.push({
    text,
    date: new Date().toLocaleDateString('es', { day:'2-digit', month:'2-digit', year:'numeric' })
  });
  localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
  ta.value = '';
  renderMemory();
  showToast('Guardado en tu diario 💫');
}

function deleteDiary(i) {
  diary.splice(i, 1);
  localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
  renderMemory();
}

function renderMissions() {
  const list = document.getElementById('missions-list');
  if (!list) return;
  list.innerHTML = '';
  if (missions.length === 0) {
    list.innerHTML = '<p class="empty">No tienes misiones aún. ¡Crea una!</p>';
    return;
  }
  missions.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'mission-card' + (m.done ? ' done' : '');
    div.innerHTML = '<div class="mission-title">' + escapeHtml(m.title) + '</div>' +
      (m.date ? '<div class="mission-date">' + m.date + '</div>' : '') +
      '<div class="mission-actions"><button onclick="toggleMission(' + i + ')">' + (m.done ? '↩️ Deshacer' : '✅ Hecho') + '</button>' +
      '<button onclick="talkMission(' + i + ')">Hablar de esto</button>' +
      '<button class="danger" onclick="deleteMission(' + i + ')">Borrar</button></div>';
    list.appendChild(div);
  });
}

function addMission() {
  const title = document.getElementById('mission-title').value.trim();
  if (!title) return showToast('Escribe una meta');
  const date = document.getElementById('mission-date').value;
  missions.push({ title, date: date || null, done: false });
  localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
  document.getElementById('mission-title').value = '';
  renderMissions();
  showToast('Misión agregada 🚀');
}

function toggleMission(i) {
  missions[i].done = !missions[i].done;
  localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
  renderMissions();
}

function deleteMission(i) {
  missions.splice(i, 1);
  localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
  renderMissions();
}

function talkMission(i) {
  const m = missions[i];
  showScreen('chat');
  document.getElementById('chat-input').value = 'Quiero hablar sobre mi meta: "' + m.title + '". Ayúdame a avanzar.';
  setTimeout(sendMessage, 250);
}

function startClock() {
  const clock = document.getElementById('live-clock');
  if (!clock) return;
  setInterval(() => {
    clock.textContent = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }, 1000);
}

function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

window.deleteDiary = deleteDiary;
window.toggleMission = toggleMission;
window.deleteMission = deleteMission;
window.talkMission = talkMission;
