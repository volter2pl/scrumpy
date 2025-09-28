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

  const CUSTOM_DECK_ID = 'custom';
  const LAST_DECK_KEY = 'scrumpy_last_deck_v1';
  const CUSTOM_DECK_KEY = 'scrumpy_custom_deck_v1';
  const ROOM_DECK_PREFIX = 'scrumpy_room_deck_';

  const builtinDecks = [
    {
      id: 'scrum-fibonacci-mini',
      name: 'Scrum Fibonacci (mini)',
      cards: ['?', '0', '1', '2', '3', '5', '8']
    },
    {
      id: 'scrum-fibonacci',
      name: 'Scrum Fibonacci',
      cards: ['?', '0', '1', '2', '3', '5', '8', '13', '21', '34', '∞', '☕']
    },
    {
      id: 'tshirt-sizes',
      name: 'Koszulki XS, S, M, L, XL',
      cards: ['XS', 'S', 'M', 'L', 'XL', '?']
    },
    {
      id: 'tshirt-sizes-extended',
      name: 'Koszulki XS → XXL',
      cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?']
    },
    {
      id: 'powers-of-two',
      name: 'Potęgi dwójki',
      cards: ['?', '0', '1', '2', '4', '8', '16', '32', '64', '∞', '☕']
    },
    {
      id: 'linear-1-10',
      name: 'Skala 1–10',
      cards: ['?', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '∞', '☕']
    }
  ];

  let allowedValues = builtinDecks[0].cards.slice();
  const uuidV4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const genUUID = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
  });

  const normalizeName = (s) => s.normalize ? s.normalize('NFC') : s;
  const trim = (s) => (s || '').trim();

  const readJSON = (storage, key, fallback) => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  const writeJSON = (storage, key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  };

  const cloneDeck = (deck) => {
    if (!deck) return null;
    return {
      id: deck.id,
      name: deck.name,
      cards: Array.isArray(deck.cards) ? deck.cards.slice() : []
    };
  };

  const deckKeyForRoom = (uuid) => `${ROOM_DECK_PREFIX}${uuid}`;

  const loadCustomDeck = () => {
    const raw = readJSON(localStorage, CUSTOM_DECK_KEY, null);
    if (!raw || !Array.isArray(raw.cards)) return null;
    const cards = raw.cards.map((v) => String(v || '').trim()).filter((v) => v.length >= 1);
    if (!cards.length) return null;
    return { id: CUSTOM_DECK_ID, name: raw.name || 'Custom', cards };
  };

  const saveCustomDeck = (deck) => {
    if (!deck || !Array.isArray(deck.cards)) {
      localStorage.removeItem(CUSTOM_DECK_KEY);
      return;
    }
    const cards = deck.cards.map((v) => String(v || '').trim()).filter((v) => v.length >= 1);
    if (!cards.length) {
      localStorage.removeItem(CUSTOM_DECK_KEY);
      return;
    }
    writeJSON(localStorage, CUSTOM_DECK_KEY, { name: deck.name || 'Custom', cards });
  };

  const loadLastDeckId = () => {
    const stored = localStorage.getItem(LAST_DECK_KEY);
    return stored || builtinDecks[0].id;
  };

  const rememberLastDeckId = (id) => {
    if (!id) return;
    try { localStorage.setItem(LAST_DECK_KEY, id); } catch (e) {}
    state.lastDeckId = id;
  };

  const loadRoomDeck = (uuid) => {
    if (!uuid) return null;
    const raw = readJSON(localStorage, deckKeyForRoom(uuid), null);
    if (!raw || !Array.isArray(raw.cards)) return null;
    const cards = raw.cards.map((v) => String(v || '').trim()).filter((v) => v.length >= 1);
    if (!cards.length) return null;
    return {
      id: raw.id || raw.deckId || CUSTOM_DECK_ID,
      name: raw.name || 'Custom',
      cards
    };
  };

  const persistRoomDeck = (uuid, deck) => {
    if (!uuid || !deck) return;
    writeJSON(localStorage, deckKeyForRoom(uuid), {
      id: deck.id,
      name: deck.name,
      cards: deck.cards
    });
  };

  const findBuiltinDeck = (id) => builtinDecks.find((d) => d.id === id) || null;

  const resolveDeckById = (id) => {
    if (!id) return null;
    if (id === CUSTOM_DECK_ID) return cloneDeck(state.customDeck || loadCustomDeck());
    const found = findBuiltinDeck(id);
    return found ? cloneDeck(found) : null;
  };

  const deckHasCards = (deck) => {
    return !!deck && Array.isArray(deck.cards) && deck.cards.length >= 2
  };

  const decksEqual = (a, b) => {
    if (!a || !b) return false;
    if (a.id !== b.id) return false;
    if (!Array.isArray(a.cards) || !Array.isArray(b.cards)) return false;
    if (a.cards.length !== b.cards.length) return false;
    for (let i = 0; i < a.cards.length; i += 1) {
      if (a.cards[i] !== b.cards[i]) return false;
    }
    return true;
  };

  const enforceDeck = (deck) => {
    if (!deckHasCards(deck)) return cloneDeck(builtinDecks[0]);
    return {
      id: deck.id || builtinDecks[0].id,
      name: deck.name || builtinDecks[0].name,
      cards: deck.cards.map((v) => String(v || '').trim()).filter((v) => v.length >= 1)
    };
  };

  const setActiveDeck = (deck) => {
    const next = enforceDeck(deck);
    state.deck = next;
    allowedValues = next.cards.slice();
    state.myVote = deckIncludesValue(state.myVote) ? String(state.myVote) : null;
    state.votes.forEach((val, key) => {
      if (!deckIncludesValue(val)) {
        state.votes.delete(key);
      } else {
        state.votes.set(key, String(val));
      }
    });
    renderDeck();
    renderParticipants();
  };

  const deckIncludesValue = (value) => {
    if (value == null) return false;
    return allowedValues.includes(String(value));
  };

  const buildPresencePayload = (overrides = {}) => {
    const deck = state.deck || enforceDeck(cloneDeck(builtinDecks[0]));
    const base = {
      userId: state.sessionId,
      name: state.myName,
      hasVoted: false,
      phase: 'hidden',
      value: null,
      deckId: deck.id,
      deckName: deck.name,
      deckValues: deck.cards
    };
    const payload = Object.assign(base, overrides || {});
    payload.value = payload.value != null ? String(payload.value) : null;
    return payload;
  };

  const getDeckPreviewText = (deck) => {
    if (!deckHasCards(deck)) return 'Brak kart w tej talii';
    const preview = deck.cards.slice(0, 8).join(', ');
    const suffix = deck.cards.length > 8 ? ', …' : '';
    return `Karty: ${preview}${suffix}`;
  };

  const addCustomDeckRow = (value = '') => {
    if (!customDeckList) return null;
    const row = document.createElement('div');
    row.className = 'custom-card-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.required = true;
    input.maxLength = 48;
    input.value = value;
    input.placeholder = 'Wartość karty';
    row.appendChild(input);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'secondary small remove-card-btn';
    removeBtn.textContent = 'Usuń';
    removeBtn.addEventListener('click', () => {
      row.remove();
      if (customDeckList.children.length === 0) addCustomDeckRow('');
    });
    row.appendChild(removeBtn);
    customDeckList.appendChild(row);
    return input;
  };

  const renderCustomDeckEditor = (cards) => {
    if (!customDeckList) return;
    customDeckList.innerHTML = '';
    const source = Array.isArray(cards) && cards.length ? cards : [''];
    source.forEach((card) => addCustomDeckRow(card));
    if (customDeckList.children.length === 0) addCustomDeckRow('');
  };

  const collectCustomDeckValues = () => {
    if (!customDeckList) return [];
    const inputs = Array.from(customDeckList.querySelectorAll('input'));
    return inputs.map((input) => trim(input.value)).filter((value) => value.length >= 1);
  };

  const closeCustomDeckEditor = () => {
    if (customDeckEditor) customDeckEditor.hidden = true;
  };

  const openCustomDeckEditor = (options = {}) => {
    if (!customDeckEditor) return;
    const { focus = true, refresh = false } = options;
    if (customDeckEditor.hidden || refresh) {
      const base = deckHasCards(state.customDeck) ? state.customDeck.cards.slice() : [];
      renderCustomDeckEditor(base);
    }
    customDeckEditor.hidden = false;
    if (focus) {
      requestAnimationFrame(() => {
        if (!customDeckList) return;
        const firstInput = customDeckList.querySelector('input');
        if (firstInput) firstInput.focus();
      });
    }
  };

  const syncCustomDeckEditorVisibility = (options = {}) => {
    if (!createDeckSelect) return;
    const { refresh = false, focus = true } = options;
    if (createDeckSelect.value === CUSTOM_DECK_ID) {
      openCustomDeckEditor({ refresh, focus });
    } else {
      closeCustomDeckEditor();
    }
  };

  const describeCustomDeckOption = () => {
    if (!deckHasCards(state.customDeck)) return 'Custom (własne karty)';
    return `Custom (${state.customDeck.cards.length} kart)`;
  };

  const resolveDeckForRoom = (roomUuid) => {
    if (state.pendingRoomDeck && state.pendingRoomDeck.uuid === roomUuid) {
      const picked = enforceDeck(state.pendingRoomDeck.deck);
      state.pendingRoomDeck = null;
      persistRoomDeck(roomUuid, picked);
      return picked;
    }
    const stored = loadRoomDeck(roomUuid);
    if (deckHasCards(stored)) return enforceDeck(stored);
    if (deckHasCards(state.deck)) return enforceDeck(state.deck);
    return cloneDeck(builtinDecks[0]);
  };

  const refreshDeckSelectOptions = () => {
    if (!createDeckSelect) return;
    const currentValue = createDeckSelect.value;
    createDeckSelect.innerHTML = '';
    builtinDecks.forEach((deck) => {
      const option = document.createElement('option');
      option.value = deck.id;
      option.textContent = deck.name;
      createDeckSelect.appendChild(option);
    });
    const customOption = document.createElement('option');
    customOption.value = CUSTOM_DECK_ID;
    customOption.textContent = describeCustomDeckOption();
    createDeckSelect.appendChild(customOption);
    if (currentValue) {
      const hasValue = createDeckSelect.querySelector(`option[value="${currentValue}"]`);
      if (hasValue) createDeckSelect.value = currentValue;
    }
  };

  const updateDeckPreview = (deckId) => {
    if (!deckPreview) return;
    const selectedId = deckId || (createDeckSelect && createDeckSelect.value);
    const deck = selectedId === CUSTOM_DECK_ID ? state.customDeck : findBuiltinDeck(selectedId);
    deckPreview.textContent = getDeckPreviewText(deck);
  };

  const initDeckSelection = () => {
    state.customDeck = loadCustomDeck();
    state.lastDeckId = loadLastDeckId();
    refreshDeckSelectOptions();
    if (createDeckSelect) {
      const exists = createDeckSelect.querySelector(`option[value="${state.lastDeckId}"]`);
      createDeckSelect.value = exists ? state.lastDeckId : builtinDecks[0].id;
      if (!exists) state.lastDeckId = createDeckSelect.value;
      updateDeckPreview(createDeckSelect.value);
      syncCustomDeckEditorVisibility({ refresh: true, focus: false });
    }
  };

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
    deck: null,
    customDeck: null,
    lastDeckId: null,
    pendingRoomDeck: null,
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
  const createDeckSelect = byId('createDeck');
  const deckPreview = byId('deckPreview');
  const joinForm = byId('joinForm');
  const joinUuid = byId('joinUuid');
  const joinName = byId('joinName');
  const customDeckEditor = byId('customDeckEditor');
  const customDeckForm = byId('customDeckForm');
  const customDeckList = byId('customDeckList');
  const addCustomCardBtn = byId('addCustomCardBtn');

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
      const incoming = deckIncludesValue(meta.value) ? String(meta.value) : null;
      const val = state.votes.get(userId) ?? incoming;
      if (val != null) values.push(String(val));
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
      let discoveredDeck = null;

      Object.entries(raw).forEach(([userId, metas]) => {
        if (!Array.isArray(metas) || !metas.length) return;
        const meta = metas[metas.length - 1];
        const phase = meta.phase === 'revealed' ? 'revealed' : 'hidden';
        if (phase === 'revealed') anyRevealed = true;

        const deckValues = Array.isArray(meta.deckValues)
          ? meta.deckValues.map((v) => String(v || '').trim()).filter((v) => v.length >= 1)
          : null;

        if (!discoveredDeck && deckValues && deckValues.length) {
          const candidateId = meta.deckId || (meta.deckName === 'Custom' ? CUSTOM_DECK_ID : builtinDecks[0].id);
          const candidateName = meta.deckName || (candidateId === CUSTOM_DECK_ID ? 'Custom' : (findBuiltinDeck(candidateId)?.name || 'Talia'));
          discoveredDeck = enforceDeck({ id: candidateId, name: candidateName, cards: deckValues });
        }

        const candidateValue = meta.value != null ? String(meta.value) : null;
        const baseValues = deckValues && deckValues.length ? deckValues : allowedValues;
        const value = candidateValue && baseValues.includes(candidateValue) ? candidateValue : null;

        next.set(userId, { name: meta.name, hasVoted: !!meta.hasVoted, value, phase });
      });

      state.presence = next;
      if (discoveredDeck && !decksEqual(discoveredDeck, state.deck)) {
        setActiveDeck(discoveredDeck);
        if (state.roomUuid) persistRoomDeck(state.roomUuid, discoveredDeck);
        const presencePayload = buildPresencePayload({
          hasVoted: state.myVote != null,
          phase: state.phase,
          value: state.phase === 'revealed' ? state.myVote : null
        });
        channel.track(presencePayload).catch(() => {});
      }
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
      const payload = buildPresencePayload({ hasVoted: state.myVote != null, phase: 'revealed', value: state.myVote ?? null });
      state.channel && state.channel.track(payload).catch(() => {});
      setTimeout(checkConsensusAndCelebrate, 50);
    });

    channel.on('broadcast', { event: 'clear' }, () => {
      state.votes.clear();
      state.myVote = null;
      state.consensusCelebrated = false;
      setPhase('hidden');
      // update presence to hasVoted=false
      const payload = buildPresencePayload({ hasVoted: false, phase: 'hidden', value: null });
      channel.track(payload).catch(() => {});
    });

    channel.on('broadcast', { event: 'user_vote' }, (payload) => {
      if (state.phase !== 'revealed') return;
      const { userId, value } = payload.payload || {};
      if (!uuidV4Re.test(String(userId || ''))) return;
      if (!deckIncludesValue(value)) return;
      state.votes.set(userId, String(value));
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
          await channel.track(buildPresencePayload());
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
    if (!deckIncludesValue(value)) return;
    sendBroadcast('user_vote', { userId: state.sessionId, value: String(value) });
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
      const resolvedValue = deckIncludesValue(p.value) ? String(p.value) : null;
      const val = state.phase === 'revealed' ? (state.votes.get(p.userId) ?? resolvedValue) : (p.hasVoted ? VOTED : UNVOTED);
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
    if (!deckIncludesValue(value)) return;
    const cardValue = String(value);
    state.myVote = cardValue;
    if (state.channel) {
      // Mark hasVoted in presence; when revealed include value and phase for late joiners
      const payload = state.phase === 'revealed'
        ? buildPresencePayload({ hasVoted: true, phase: 'revealed', value: cardValue })
        : buildPresencePayload({ hasVoted: true, phase: 'hidden', value: null });
      state.channel.track(payload).catch(() => {});
    }
    if (state.phase === 'revealed') {
      sendUserVote(cardValue);
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
    if (createDeckSelect) {
      syncCustomDeckEditorVisibility({ refresh: true, focus: false });
    } else {
      closeCustomDeckEditor();
    }
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
    const deckForRoom = resolveDeckForRoom(roomUuid);
    setActiveDeck(deckForRoom);
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
  if (createDeckSelect) {
    createDeckSelect.addEventListener('change', () => {
      const selected = createDeckSelect.value;
      rememberLastDeckId(selected);
      updateDeckPreview(selected);
      syncCustomDeckEditorVisibility({ refresh: true });
    });
  }

  if (addCustomCardBtn) {
    addCustomCardBtn.addEventListener('click', () => {
      const input = addCustomDeckRow('');
      if (input) input.focus();
    });
  }

  if (customDeckForm) {
    customDeckForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cards = collectCustomDeckValues();
      if (!cards.length) {
        alert('Dodaj przynajmniej jedną kartę.');
        if (customDeckList) {
          const input = customDeckList.querySelector('input');
          if (input) input.focus();
        }
        return;
      }
      const deck = { id: CUSTOM_DECK_ID, name: 'Custom', cards };
      state.customDeck = deck;
      saveCustomDeck(deck);
      refreshDeckSelectOptions();
      if (createDeckSelect) {
        createDeckSelect.value = CUSTOM_DECK_ID;
      }
      rememberLastDeckId(CUSTOM_DECK_ID);
      updateDeckPreview(CUSTOM_DECK_ID);
      if (createDeckSelect && createDeckSelect.value === CUSTOM_DECK_ID) {
        setActiveDeck(deck);
        openCustomDeckEditor({ refresh: true, focus: false });
      } else {
        syncCustomDeckEditorVisibility();
      }
    });
  }

  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let name = trim(normalizeName(createName.value));
    if (name.length < 1 || name.length > 40) {
      alert('Imię musi mieć 1–40 znaków.');
      return;
    }
    sessionStorage.setItem('scrumpo_name', name);
    const selectedDeckId = createDeckSelect ? createDeckSelect.value : builtinDecks[0].id;
    const resolvedDeck = resolveDeckById(selectedDeckId) || null;
    if (selectedDeckId === CUSTOM_DECK_ID && !deckHasCards(resolvedDeck)) {
      alert('Brak zdefiniowanych kart. Dodaj co najmniej dwie karty do talii.');
      syncCustomDeckEditorVisibility({ refresh: true, focus: true });
      return;
    }
    rememberLastDeckId(selectedDeckId);
    const enforcedDeck = enforceDeck(resolvedDeck);
    const uuid = genUUID();
    state.pendingRoomDeck = { uuid, deck: enforcedDeck };
    persistRoomDeck(uuid, enforcedDeck);
    setActiveDeck(enforcedDeck);
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
    state.pendingRoomDeck = null;
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
    initDeckSelection();
    const initialDeckId = createDeckSelect ? createDeckSelect.value : builtinDecks[0].id;
    const initialDeck = resolveDeckById(initialDeckId) || cloneDeck(builtinDecks[0]);
    setActiveDeck(initialDeck);
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
