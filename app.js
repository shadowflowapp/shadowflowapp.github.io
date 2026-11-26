(() => {
  'use strict';

  const STORAGE_KEY = 'swipelago_th_mvp_v1';
  const SWIPE_THRESHOLD = 90;

  // Fallback dataset in case index.html is opened directly via file:// without a local server
  const FALLBACK_DB = [
    { id: 1, en: "Break a leg!", type: "Idiom", th_correct: "ขอให้โชคดีนะ!", th_wrong: "ระวังขาหักนะ!" },
    { id: 2, en: "My favorite color is gray.", type: "Sentence", th_correct: "สีโปรดของฉันคือสีเทา", th_wrong: "สีโปรดของฉันคือสีเขียว" },
    { id: 3, en: "I'm running late.", type: "Phrase", th_correct: "ฉันกำลังจะไปสายแล้ว", th_wrong: "ฉันกำลังวิ่งออกกำลังกายตอนดึก" },
    { id: 4, en: "Could I get the check, please?", type: "Sentence", th_correct: "ขอเช็กบิลด้วยครับ/ค่ะ", th_wrong: "ขอตรวจสอบเอกสารหน่อยครับ/ค่ะ" },
    { id: 5, en: "It's a piece of cake.", type: "Idiom", th_correct: "มันง่ายมาก", th_wrong: "มันคือขนมเค้กหนึ่งชิ้น" }
  ];

  const RANKS = [
    { minLevel: 1, name: "ROOKIE" },
    { minLevel: 3, name: "EXPLORER" },
    { minLevel: 5, name: "CHALLENGER" },
    { minLevel: 8, name: "VANGUARD" },
    { minLevel: 12, name: "MASTER" },
    { minLevel: 16, name: "LEGEND" }
  ];

  // App State
  let db = [];
  let deck = [];
  let currentCard = null;
  let cardCounter = 0;
  let isAnimating = false;
  let toastTimer = null;
  let preferredVoice = null;
  let audioCtx = null;

  let player = loadPlayer();

  // DOM References
  const cardMount = document.getElementById('cardMount');
  const arena = document.getElementById('arena');
  const hudLevel = document.getElementById('hudLevel');
  const hudRank = document.getElementById('hudRank');
  const hudXp = document.getElementById('hudXp');
  const hudStreak = document.getElementById('hudStreak');
  const xpBarFill = document.getElementById('xpBarFill');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const feedbackToast = document.getElementById('feedbackToast');
  const dashboardModal = document.getElementById('dashboardModal');

  // --- Persistence ---
  function defaultPlayer() {
    return {
      xp: 0,
      streak: 0,
      bestStreak: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      listeningTotal: 0,
      listeningCorrect: 0,
      soundEnabled: true,
      mistakes: []
    };
  }

  function loadPlayer() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultPlayer(), ...JSON.parse(raw) } : defaultPlayer();
    } catch {
      return defaultPlayer();
    }
  }

  function savePlayer() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  }

  // --- Level & XP Curve ---
  function getLevelInfo(totalXp) {
    let level = 1;
    let remaining = totalXp;
    let needed = 100;

    while (remaining >= needed) {
      remaining -= needed;
      level++;
      needed = Math.round(100 * Math.pow(1.25, level - 1));
    }

    let rankName = RANKS[0].name;
    for (const r of RANKS) {
      if (level >= r.minLevel) rankName = r.name;
    }

    return { level, rankName, currentXp: remaining, neededXp: needed };
  }

  // --- Web Audio API Synthesized SFX ---
  function playSfx(type) {
    if (!player.soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'correct') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      } else if (type === 'levelup') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'triangle';
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(freq, now + i * 0.08);
          g.gain.setValueAtTime(0.14, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          o.start(now + i * 0.08);
          o.stop(now + i * 0.08 + 0.26);
        });
      }
    } catch {
      // Ignore audio errors on restricted devices
    }
  }

  // --- American English TTS ---
  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      preferredVoice =
        voices.find(v => v.lang === 'en-US' && /Google|Samantha|Aria|Natural/i.test(v.name)) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en'));
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speakEnglish(text, rate = 0.96) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    if (preferredVoice) utter.voice = preferredVoice;
    window.speechSynthesis.speak(utter);
  }

  // --- Load JSONL Database ---
  async function loadDatabase() {
    try {
      const res = await fetch('./db.jsonl');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const parsed = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line));

      if (parsed.length > 0) return parsed;
    } catch (err) {
      console.warn('Could not fetch db.jsonl (run via local server). Using built-in fallback.', err);
    }
    return FALLBACK_DB;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextCardData() {
    if (deck.length === 0) deck = shuffle(db);
    const entry = deck.pop();
    cardCounter++;

    const isMatch = Math.random() < 0.5;
    // Guarantee an Audio Challenge on card #3, then ~35% chance thereafter
    const isAudioOnly = cardCounter === 3 ? true : Math.random() < 0.35;

    return {
      ...entry,
      isMatch,
      isAudioOnly,
      shownThai: isMatch ? entry.th_correct : entry.th_wrong
    };
  }

  // --- Render HUD & Card ---
  function updateHud() {
    const info = getLevelInfo(player.xp);
    hudLevel.textContent = info.level;
    hudRank.textContent = info.rankName;
    hudXp.textContent = `${info.currentXp} / ${info.neededXp} XP`;
    xpBarFill.style.width = `${Math.min(100, (info.currentXp / info.neededXp) * 100)}%`;
    hudStreak.textContent = `🔥 ${player.streak}`;
    soundToggleBtn.textContent = player.soundEnabled ? '🔊' : '🔇';
  }

  function renderCard() {
    currentCard = nextCardData();
    const xpReward = currentCard.isAudioOnly ? '+35 XP 🎧' : '+20 XP';

    const cardEl = document.createElement('div');
    cardEl.className = `card${currentCard.isAudioOnly ? ' audio-mode' : ''}`;

    cardEl.innerHTML = `
      <div class="stamp match">MATCH</div>
      <div class="stamp nope">WRONG</div>

      <div class="card-header">
        <span class="tag ${currentCard.isAudioOnly ? 'listening' : ''}">
          ${currentCard.isAudioOnly ? '🎧 Listening Challenge' : currentCard.type}
        </span>
        <span class="xp-reward-tag">${xpReward}</span>
      </div>

      <div class="english-zone">
        ${
          currentCard.isAudioOnly
            ? `
              <button class="big-audio-btn" data-audio="normal" aria-label="Listen to English phrase">🔊</button>
              <div class="listen-hint">Tap to listen (US English)</div>
              <div class="mini-audio-row">
                <button class="audio-pill-btn" data-audio="slow">🐢 Slow 0.7x</button>
              </div>
            `
            : `
              <div class="english-phrase">${escapeHtml(currentCard.en)}</div>
              <div class="mini-audio-row">
                <button class="audio-pill-btn" data-audio="normal">🔊 Listen</button>
                <button class="audio-pill-btn" data-audio="slow">🐢 Slow</button>
              </div>
            `
        }
      </div>

      <div class="divider"></div>

      <div class="thai-zone">
        <div class="thai-label">Thai Meaning</div>
        <div class="thai-meaning">${escapeHtml(currentCard.shownThai)}</div>
      </div>
    `;

    // Audio buttons inside card (prevent triggering drag)
    cardEl.querySelectorAll('[data-audio]').forEach(btn => {
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const rate = btn.dataset.audio === 'slow' ? 0.7 : 0.96;
        speakEnglish(currentCard.en, rate);
      });
    });

    attachSwipeHandlers(cardEl);

    cardMount.innerHTML = '';
    cardMount.appendChild(cardEl);

    // Subtle entrance animation
    cardEl.style.transform = 'scale(0.95)';
    cardEl.style.opacity = '0';
    requestAnimationFrame(() => {
      cardEl.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
      cardEl.style.transform = 'scale(1)';
      cardEl.style.opacity = '1';
      setTimeout(() => {
        cardEl.style.transition = '';
      }, 230);
    });

    // Auto-speak audio-only cards after first user interaction
    if (currentCard.isAudioOnly && player.totalAnswered > 0) {
      setTimeout(() => speakEnglish(currentCard.en, 0.96), 220);
    }
  }

  // --- Unified Mobile Touch + PC Mouse Drag Physics ---
  function attachSwipeHandlers(cardEl) {
    const stampMatch = cardEl.querySelector('.stamp.match');
    const stampNope = cardEl.querySelector('.stamp.nope');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;

    cardEl.addEventListener('pointerdown', e => {
      if (isAnimating) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      currentX = 0;
      cardEl.setPointerCapture(e.pointerId);
      cardEl.style.transition = '';
    });

    cardEl.addEventListener('pointermove', e => {
      if (!isDragging) return;
      currentX = e.clientX - startX;
      const dy = (e.clientY - startY) * 0.22;
      const rotate = currentX * 0.055;

      cardEl.style.transform = `translate3d(${currentX}px, ${dy}px, 0) rotate(${rotate}deg)`;

      const ratio = Math.min(1, Math.abs(currentX) / SWIPE_THRESHOLD);
      if (currentX > 0) {
        stampMatch.style.opacity = ratio;
        stampNope.style.opacity = 0;
      } else {
        stampNope.style.opacity = ratio;
        stampMatch.style.opacity = 0;
      }
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;

      if (currentX >= SWIPE_THRESHOLD) {
        commitSwipe(true, cardEl);
      } else if (currentX <= -SWIPE_THRESHOLD) {
        commitSwipe(false, cardEl);
      } else {
        cardEl.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        cardEl.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
        stampMatch.style.opacity = 0;
        stampNope.style.opacity = 0;
      }
    };

    cardEl.addEventListener('pointerup', endDrag);
    cardEl.addEventListener('pointercancel', endDrag);
  }

  // --- Evaluate Answer & Gamification ---
  function commitSwipe(userSwipedRight, cardEl) {
    if (isAnimating || !currentCard) return;
    isAnimating = true;

    const el = cardEl || cardMount.querySelector('.card');
    if (el) {
      const dir = userSwipedRight ? 1 : -1;
      el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in';
      el.style.transform = `translate3d(${dir * 460}px, 30px, 0) rotate(${dir * 22}deg)`;
      el.style.opacity = '0';
    }

    const isCorrect = userSwipedRight === currentCard.isMatch;
    const prevLevel = getLevelInfo(player.xp).level;

    player.totalAnswered++;
    if (currentCard.isAudioOnly) player.listeningTotal++;

    if (isCorrect) {
      player.totalCorrect++;
      if (currentCard.isAudioOnly) player.listeningCorrect++;
      player.streak++;
      if (player.streak > player.bestStreak) player.bestStreak = player.streak;

      const baseXp = currentCard.isAudioOnly ? 35 : 20;
      const multiplier = player.streak >= 10 ? 2 : player.streak >= 5 ? 1.5 : 1;
      const earnedXp = Math.round(baseXp * multiplier);
      player.xp += earnedXp;

      const newLevel = getLevelInfo(player.xp).level;
      playSfx(newLevel > prevLevel ? 'levelup' : 'correct');

      spawnXpPop(
        newLevel > prevLevel
          ? `LEVEL UP! LVL ${newLevel}`
          : `+${earnedXp} XP${multiplier > 1 ? ` (x${multiplier})` : ''}`
      );

      if (currentCard.isAudioOnly) {
        showToast(true, `✓ Correct! "${currentCard.en}" = ${currentCard.th_correct}`);
      } else {
        showToast(true, `✓ Spot on! Streak: ${player.streak}`);
      }
    } else {
      player.streak = 0;
      playSfx('wrong');

      // Record mistake for review (keep last 8 unique items)
      player.mistakes = [
        { en: currentCard.en, th: currentCard.th_correct },
        ...player.mistakes.filter(m => m.en !== currentCard.en)
      ].slice(0, 8);

      showToast(false, `✕ "${currentCard.en}" means: ${currentCard.th_correct}`);
    }

    savePlayer();
    updateHud();

    setTimeout(() => {
      isAnimating = false;
      renderCard();
    }, 280);
  }

  function spawnXpPop(text) {
    const pop = document.createElement('div');
    pop.className = 'xp-pop';
    pop.textContent = text;
    arena.appendChild(pop);
    setTimeout(() => pop.remove(), 920);
  }

  function showToast(isCorrect, message) {
    clearTimeout(toastTimer);
    feedbackToast.textContent = message;
    feedbackToast.className = `toast show ${isCorrect ? 'correct' : 'wrong'}`;
    toastTimer = setTimeout(() => {
      feedbackToast.classList.remove('show');
    }, 2400);
  }

  // --- Dashboard Modal ---
  function openDashboard() {
    const acc = player.totalAnswered
      ? Math.round((player.totalCorrect / player.totalAnswered) * 100)
      : 0;
    const listenAcc = player.listeningTotal
      ? Math.round((player.listeningCorrect / player.listeningTotal) * 100)
      : 0;

    document.getElementById('statTotalXp').textContent = player.xp;
    document.getElementById('statAccuracy').textContent = `${acc}%`;
    document.getElementById('statBestStreak').textContent = `🔥 ${player.bestStreak}`;
    document.getElementById('statListening').textContent = `${listenAcc}%`;

    const listEl = document.getElementById('mistakesList');
    if (player.mistakes.length === 0) {
      listEl.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">No mistakes yet — keep swiping!</div>`;
    } else {
      listEl.innerHTML = player.mistakes
        .map(m => `<div class="mistake-item"><div class="en">${escapeHtml(m.en)}</div><div class="th">${escapeHtml(m.th)}</div></div>`)
        .join('');
    }

    dashboardModal.classList.add('open');
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  // --- Wire Controls & Keyboard ---
  document.getElementById('btnNope').addEventListener('click', () => commitSwipe(false));
  document.getElementById('btnMatch').addEventListener('click', () => commitSwipe(true));
  document.getElementById('btnReplay').addEventListener('click', () => {
    if (currentCard) speakEnglish(currentCard.en, 0.96);
  });

  soundToggleBtn.addEventListener('click', () => {
    player.soundEnabled = !player.soundEnabled;
    savePlayer();
    updateHud();
  });

  document.getElementById('openDashboardBtn').addEventListener('click', openDashboard);
  document.getElementById('statsBtn').addEventListener('click', openDashboard);
  document.getElementById('closeDashboardBtn').addEventListener('click', () => {
    dashboardModal.classList.remove('open');
  });
  dashboardModal.addEventListener('click', e => {
    if (e.target === dashboardModal) dashboardModal.classList.remove('open');
  });

  document.getElementById('resetProgressBtn').addEventListener('click', () => {
    if (confirm('Reset all XP, streaks, and stats?')) {
      player = defaultPlayer();
      savePlayer();
      updateHud();
      dashboardModal.classList.remove('open');
    }
  });

  window.addEventListener('keydown', e => {
    if (dashboardModal.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') commitSwipe(false);
    else if (e.key === 'ArrowRight') commitSwipe(true);
    else if (e.key === ' ') {
      e.preventDefault();
      if (currentCard) speakEnglish(currentCard.en, 0.96);
    }
  });

  // --- Boot ---
  async function init() {
    initVoices();
    updateHud();
    db = await loadDatabase();
    renderCard();
  }

  init();
})();
