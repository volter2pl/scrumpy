(() => {
  'use strict';

  const UNVOTED = '';
  const VOTED = '✓';

  const CONNECTED    = {text: '🙂', cls: 'ok', desc: 'Połączono'};
  const CONNECTING   = {text: '😐', cls: 'warn', desc: 'Łączenie…'};
  const DISCONNECTED = {text: '🙁', cls: 'err', desc: 'Rozłączono'};
  const COPIED_LINK  = {text: '📋', cls: 'ok', desc: 'Skopiowano link'};
  const COPIED_ID    = {text: '📋', cls: 'ok', desc: 'Skopiowano numer'};

  // --- Helpers ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  const allowedValues = ['?', 0, 1, 2, 3, 5, 8, 13];
  const uuidV4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const genUUID = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
  });

  const normalizeName = (s) => s.normalize ? s.normalize('NFC') : s;
  const trim = (s) => (s || '').trim();

  // --- State ---
  const state = {
    supabase: null,
    channel: null,
    connected: false,
    sessionId: null,
    myName: null,
    roomUuid: null,
    phase: 'hidden',
    myVote: null,
    presence: new Map(), // userId -> { name, hasVoted }
    votes: new Map() // userId -> value (only after reveal)
  };

  // --- UI Elements ---
  const homeView = byId('homeView');
  const roomView = byId('roomView');
  const roomHeader = byId('roomHeader');
  const roomIdInput = byId('roomIdInput');
  const copyLinkBtn = byId('copyLinkBtn');
  const copyRoomBtn = byId('copyRoomBtn');
  const exitBtn = byId('exitBtn');
  const connStatus = byId('connStatus');
  const overlay = byId('overlay');
  const overlayMsg = byId('overlayMsg');
  const participantsEl = byId('participants');
  const deckEl = byId('deck');
  const revealBtn = byId('revealBtn');
  const clearBtn = byId('clearBtn');

  // Forms
  const createForm = byId('createForm');
  const createName = byId('createName');
  const joinForm = byId('joinForm');
  const joinUuid = byId('joinUuid');
  const joinName = byId('joinName');

  // --- Supabase ---
  function ensureSupabase() {
    if (state.supabase) return state.supabase;
    if (!window.ENV || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
      console.error('Brak konfiguracji SUPABASE_URL / SUPABASE_ANON_KEY w config.js');
      alert('Brak konfiguracji Supabase. Uzupełnij config.js.');
      return null;
    }
    state.supabase = window.supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
    return state.supabase;
  }

  function setConnStatus(status) {
    connStatus.textContent = status.text;
    connStatus.className = `badge ${status.cls}`;
    connStatus.title = status.desc || '';
    if (overlayMsg) overlayMsg.textContent = status.desc || status.text;
  }

  function setPhase(phase) {
    state.phase = phase;
    renderDeck();
    renderParticipants();
  }

  function renderOverlay() {
    const shouldShow = !state.connected;
    if (!overlay) return;
    overlay.hidden = !shouldShow;
    // Disable action buttons while not connected
    revealBtn.disabled = shouldShow;
    clearBtn.disabled = shouldShow;
  }

  function celebrate() {
    if (!window.confetti) return;
    window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => window.confetti({ particleCount: 100, spread: 100, origin: { x: 0, y: 0.6 } }), 120);
    setTimeout(() => window.confetti({ particleCount: 100, spread: 100, origin: { x: 1, y: 0.6 } }), 220);
  }

  function checkConsensusAndCelebrate() {
    if (state.phase !== 'revealed' || state.consensusCelebrated) return;
    const values = [];
    state.presence.forEach((meta, userId) => {
      if (!meta || !meta.hasVoted) return;
      const val = state.votes.get(userId) ?? (allowedValues.includes(meta.value) ? meta.value : null);
      if (val != null) values.push(val);
    });
    const minConsensusCount = 2;
    if (values.length < minConsensusCount) return;
    const first = values[0];
    const allEqual = values.every(v => v === first);
    if (allEqual) {
      state.consensusCelebrated = true;
      celebrate();
    }
  }

  async function connectRoom(roomUuid) {
    const client = ensureSupabase();
    if (!client) return;

    cleanupChannel();
    const sessionId = state.sessionId || genUUID();
    state.sessionId = sessionId;

    const channel = client.channel('room:' + roomUuid, {
      config: {
        presence: { key: sessionId },
        broadcast: { self: true }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const raw = channel.presenceState();
      const next = new Map();
      let anyRevealed = false;
      Object.entries(raw).forEach(([userId, metas]) => {
        if (Array.isArray(metas) && metas.length) {
          const m = metas[metas.length - 1];
          const phase = m.phase === 'revealed' ? 'revealed' : 'hidden';
          if (phase === 'revealed') anyRevealed = true;
          const value = allowedValues.includes(m.value) ? m.value : null;
          next.set(userId, { name: m.name, hasVoted: !!m.hasVoted, value, phase });
        }
      });
      state.presence = next;
      const newPhase = anyRevealed ? 'revealed' : 'hidden';
      if (newPhase !== state.phase) setPhase(newPhase);
      renderParticipants();
    });

    channel.on('broadcast', { event: 'reveal' }, () => {
      setPhase('revealed');
      if (state.myVote != null) {
        sendUserVote(state.myVote);
      }
      // also publish phase and (optional) value in presence, so late joiners see votes
      const payload = { userId: state.sessionId, name: state.myName, hasVoted: state.myVote != null, phase: 'revealed', value: state.myVote ?? null };
      state.channel && state.channel.track(payload).catch(() => {});
      setTimeout(checkConsensusAndCelebrate, 50);
    });

    channel.on('broadcast', { event: 'clear' }, () => {
      state.votes.clear();
      state.myVote = null;
      state.consensusCelebrated = false;
      setPhase('hidden');
      // update presence to hasVoted=false
      const payload = { userId: state.sessionId, name: state.myName, hasVoted: false, phase: 'hidden', value: null };
      channel.track(payload).catch(() => {});
    });

    channel.on('broadcast', { event: 'user_vote' }, (payload) => {
      if (state.phase !== 'revealed') return;
      const { userId, value } = payload.payload || {};
      if (!uuidV4Re.test(String(userId || ''))) return;
      if (!allowedValues.includes(value)) return;
      state.votes.set(userId, value);
      renderParticipants();
      checkConsensusAndCelebrate();
    });

    setConnStatus(CONNECTING);
    state.connected = false;
    state.channel = channel;
    renderOverlay();

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        state.connected = true;
        setConnStatus(CONNECTED);
        renderOverlay();
        try {
          await channel.track({ userId: sessionId, name: state.myName, hasVoted: false, phase: 'hidden', value: null });
        } catch (e) {}
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        state.connected = false;
        setConnStatus(DISCONNECTED);
        renderOverlay();
      }
    });
  }

  function cleanupChannel() {
    if (state.channel) {
      try { state.channel.unsubscribe(); } catch (e) {}
    }
    state.channel = null;
    state.connected = false;
    setConnStatus(DISCONNECTED);
    renderOverlay();
  }

  function sendBroadcast(event, payload) {
    if (!state.channel) return;
    state.channel.send({ type: 'broadcast', event, payload });
  }

  function sendUserVote(value) {
    sendBroadcast('user_vote', { userId: state.sessionId, value });
  }

  // --- Rendering ---
  function renderParticipants() {
    const phase = state.phase;
    const list = Array.from(state.presence.entries()).map(([userId, meta]) => ({ userId, ...meta }));
    list.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

    participantsEl.innerHTML = '';
    for (const p of list) {
      const item = document.createElement('div');
      item.className = 'participant';
      const title = document.createElement('div');
      title.className = 'name';
      title.textContent = p.name || '(bezimienny)';
      const card = document.createElement('div');
      const val = state.phase === 'revealed' ? (state.votes.get(p.userId) ?? (allowedValues.includes(p.value) ? p.value : null)) : (p.hasVoted ? VOTED : UNVOTED);
      card.className = `mini-card ${state.phase === 'revealed' ? 'revealed' : 'hidden'}`;
      card.textContent = val == null ? UNVOTED : String(val);
      item.appendChild(title);
      item.appendChild(card);
      participantsEl.appendChild(item);
    }
  }

  function renderDeck() {
    deckEl.innerHTML = '';
    for (const v of allowedValues) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-btn';
      btn.textContent = String(v);
      if (state.myVote === v) btn.classList.add('active');
      btn.addEventListener('click', () => onSelectCard(v));
      deckEl.appendChild(btn);
    }
  }

  function onSelectCard(value) {
    if (!allowedValues.includes(value)) return;
    state.myVote = value;
    if (state.channel) {
      // Mark hasVoted in presence; when revealed include value and phase for late joiners
      const payload = state.phase === 'revealed'
        ? { userId: state.sessionId, name: state.myName, hasVoted: true, phase: 'revealed', value }
        : { userId: state.sessionId, name: state.myName, hasVoted: true, phase: 'hidden', value: null };
      state.channel.track(payload).catch(() => {});
    }
    if (state.phase === 'revealed') {
      sendUserVote(value);
    }
    renderDeck();
    renderParticipants();
  }

  // --- Navigation ---
  function showHome() {
    cleanupChannel();
    homeView.hidden = false;
    roomView.hidden = true;
    roomHeader.hidden = true;
    if (roomIdInput) roomIdInput.value = '';
  }

  function showRoom() {
    homeView.hidden = true;
    roomView.hidden = false;
    roomHeader.hidden = false;
    if (roomIdInput) roomIdInput.value = state.roomUuid;
    renderDeck();
    renderParticipants();
    renderOverlay();
  }

  async function enterRoom(roomUuid, name) {
    state.roomUuid = roomUuid;
    state.myName = name;
    state.votes.clear();
    state.presence.clear();
    state.consensusCelebrated = false;
    setPhase('hidden');
    showRoom();
    await connectRoom(roomUuid);
  }

  function leaveRoom() {
    window.location.hash = '';
    showHome();
  }

  function parseHash() {
    const h = window.location.hash.replace(/^#/, '');
    const parts = h.split('/').filter(Boolean);
    if (parts.length === 2 && parts[0] === 'room' && uuidV4Re.test(parts[1])) {
      return { roomUuid: parts[1] };
    }
    return null;
  }

  async function route() {
    const parsed = parseHash();
    if (!parsed) {
      showHome();
      return;
    }
    // Require name: if not provided, prompt using a simple modal-less prompt.
    let name = state.myName || sessionStorage.getItem('scrumpo_name') || '';
    if (!name) {
      name = prompt('Podaj imię:') || '';
      name = trim(normalizeName(name));
      if (name.length < 1 || name.length > 40) {
        alert('Nieprawidłowe imię. Wróć i spróbuj ponownie.');
        window.location.hash = '';
        return;
      }
      sessionStorage.setItem('scrumpo_name', name);
    }
    await enterRoom(parsed.roomUuid, name);
  }

  // --- Events ---
  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let name = trim(normalizeName(createName.value));
    if (name.length < 1 || name.length > 40) {
      alert('Imię musi mieć 1–40 znaków.');
      return;
    }
    sessionStorage.setItem('scrumpo_name', name);
    const uuid = genUUID();
    window.location.hash = `#/room/${uuid}`;
  });

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let uuid = trim(joinUuid.value);
    let name = trim(normalizeName(joinName.value));
    if (!uuidV4Re.test(uuid)) {
      alert('Nieprawidłowy ID pokoju.');
      return;
    }
    if (name.length < 1 || name.length > 40) {
      alert('Imię musi mieć 1–40 znaków.');
      return;
    }
    sessionStorage.setItem('scrumpo_name', name);
    window.location.hash = `#/room/${uuid}`;
  });

  copyLinkBtn.addEventListener('click', async () => {
    const url = window.location.href;
    try {
       await navigator.clipboard.writeText(url);
       setConnStatus(COPIED_LINK);
       setTimeout(() => setConnStatus(state.connected ? CONNECTED : DISCONNECTED), 1200);
      } catch(e){
        alert('Nie udało się skopiować linku');
      }
  });

  copyRoomBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.roomUuid || '');
      setConnStatus(COPIED_ID);
      setTimeout(() => setConnStatus(state.connected ? CONNECTED : DISCONNECTED), 1200);
    } catch(e){
      alert('Nie udało się skopiować numeru');
    }
  });

  exitBtn.addEventListener('click', () => leaveRoom());

  revealBtn.addEventListener('click', () => {
    if (!confirm('Odsłonić głosy?')) return;
    sendBroadcast('reveal', { by: state.sessionId });
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Wyczyścić wszystkie głosy?')) return;
    sendBroadcast('clear', { by: state.sessionId });
  });

  window.addEventListener('hashchange', route);

  // Initial route
  document.addEventListener('DOMContentLoaded', () => {
    // Prefill names if stored
    const stored = sessionStorage.getItem('scrumpo_name');
    if (stored) {
      createName.value = stored;
      joinName.value = stored;
    }
    route();
  });
})();

(function () {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggleBtn");
  const storageKey = "theme";

  // initial theme with localStorage or with system symbol
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    root.setAttribute("data-theme", saved);
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    root.setAttribute("data-theme", "light");
  }

  btn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem(storageKey, next);
  });
})();
