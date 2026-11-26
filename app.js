(() => {
  'use strict';

  const SUPABASE_CONFIG = {
    enabled: false,
    url: '',
    anonKey: ''
  };

  const STORAGE_KEY = 'swipelago_gta_v3';
  const SWIPE_THRESHOLD = 85;
  const N_PLUS_ONE_OFFSET = 0.35;
  const CEFR_BUCKETS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

  const GTA_RANKS = [
    { minLvl: 1, name: 'STREET' },
    { minLvl: 3, name: 'HUSTLER' },
    { minLvl: 6, name: 'ENFORCER' },
    { minLvl: 10, name: 'BOSS' },
    { minLvl: 15, name: 'KINGPIN' },
    { minLvl: 20, name: 'LEGEND' }
  ];

  // =========================================================================
  // 1. DATA SERVICE (Dynamic db/a1..c2.jsonl + Supabase RPC Ready)
  // =========================================================================
  const DataService = {
    supabase: null,
    bucketCache: new Map(),

    init() {
      if (SUPABASE_CONFIG.enabled && window.supabase) {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      }
    },

    async signInWithGoogle() {
      if (!this.supabase) {
        alert('Connect Supabase URL & anonKey in SUPABASE_CONFIG to enable Google Sign-In.');
        return;
      }
      await this.supabase.auth.signInWithOAuth({ provider: 'google' });
    },

    // Fetches only the CEFR bucket file needed (e.g. db/a1.jsonl) and caches it
    async loadBucket(cefr) {
      if (this.bucketCache.has(cefr)) return this.bucketCache.get(cefr);

      if (this.supabase) {
        const { data, error } = await this.supabase.rpc('get_next_batch', { limit_count: 25 });
        if (!error && data?.length) {
          this.bucketCache.set(cefr, data);
          return data;
        }
      }

      try {
        const res = await fetch(`./db/${cefr}.jsonl`);
        if (!res.ok) throw new Error(`Missing db/${cefr}.jsonl`);
        const text = await res.text();
        const rows = text
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
          .map((line, idx) => {
            const obj = JSON.parse(line);
            return {
              key: `${cefr}_${idx}`, // No manual id required in JSONL
              cefr,
              difficulty: Number(obj.difficulty) || bucketDefaultDifficulty(cefr),
              en: obj.en,
              th_correct: obj.th_correct,
              th_wrong: obj.th_wrong
            };
          });
        this.bucketCache.set(cefr, rows);
        return rows;
      } catch {
        this.bucketCache.set(cefr, []);
        return [];
      }
    },

    // Loads target n+1 bucket and adjacent bucket; falls back to any available bucket if some files don't exist yet
    async getCandidatePool(targetDifficulty) {
      const primary = difficultyToBucket(targetDifficulty);
      const idx = CEFR_BUCKETS.indexOf(primary);
      const neighbors = [primary, CEFR_BUCKETS[idx - 1], CEFR_BUCKETS[idx + 1]].filter(Boolean);

      const loaded = await Promise.all(neighbors.map(b => this.loadBucket(b)));
      let pool = loaded.flat();

      if (pool.length === 0) {
        const all = await Promise.all(CEFR_BUCKETS.map(b => this.loadBucket(b)));
        pool = all.flat();
      }
      return pool;
    },

    loadProfile() {
      const defaults = {
        userId: null,
        xp: 0,
        skillRating: 1.2, // Hidden CEFR scale: 1.0 (a1) -> 6.0 (c2)
        streak: 0,
        bestStreak: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        soundEnabled: true,
        recentKeys: [],
        mistakes: []
      };
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
      } catch {
        return defaults;
      }
    },

    async saveProfile(profile) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      if (this.supabase && profile.userId) {
        await this.supabase.from('profiles').upsert({
          id: profile.userId,
          xp: profile.xp,
          skill_rating: profile.skillRating,
          streak: profile.streak,
          best_streak: profile.bestStreak,
          total_answered: profile.totalAnswered,
          total_correct: profile.totalCorrect
        });
      }
    }
  };

  function difficultyToBucket(d) {
    if (d < 2.0) return 'a1';
    if (d < 3.0) return 'a2';
    if (d < 4.0) return 'b1';
    if (d < 5.0) return 'b2';
    if (d < 5.75) return 'c1';
    return 'c2';
  }

  function bucketDefaultDifficulty(cefr) {
    return { a1: 1.4, a2: 2.4, b1: 3.4, b2: 4.4, c1: 5.3, c2: 5.9 }[cefr] || 1.5;
  }

  // =========================================================================
  // 2. HIDDEN ADAPTIVE ENGINE (n+1)
  // =========================================================================
  function pickAdaptiveCard(pool, profile) {
    const target = Math.min(6.0, Math.max(1.0, profile.skillRating + N_PLUS_ONE_OFFSET));
    const cooldown = new Set(profile.recentKeys.slice(-10));

    let candidates = pool.filter(p => !cooldown.has(p.key));
    if (candidates.length === 0) candidates = pool;

    candidates.sort((a, b) => {
      const scoreA = Math.abs(a.difficulty - target) + Math.random() * 0.45;
      const scoreB = Math.abs(b.difficulty - target) + Math.random() * 0.45;
      return scoreA - scoreB;
    });

    return candidates[0];
  }

  function updateSkillRating(profile, cardDifficulty, isCorrect, isAudioOnly) {
    const expected = 1 / (1 + Math.pow(10, (cardDifficulty - profile.skillRating) / 1.5));
    const k = isAudioOnly ? 0.32 : 0.24;
    const next = profile.skillRating + k * ((isCorrect ? 1 : 0) - expected);
    profile.skillRating = Math.round(Math.min(6.0, Math.max(1.0, next)) * 100) / 100;
  }

  // =========================================================================
  // 3. HOMING PARTICLES (Glowing Card -> XP Bar)
  // =========================================================================
  const phoneShell = document.getElementById('phoneShell');
  const fxCanvas = document.getElementById('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');
  const xpTrack = document.getElementById('xpTrack');
  let particles = [];
  let fxRaf = null;

  function resizeFx() {
    const r = phoneShell.getBoundingClientRect();
    fxCanvas.width = r.width;
    fxCanvas.height = r.height;
  }

  function launchXpParticles(fromEl) {
    resizeFx();
    const shellRect = phoneShell.getBoundingClientRect();
    const cardRect = fromEl.getBoundingClientRect();
    const barRect = xpTrack.getBoundingClientRect();

    const startX = cardRect.left - shellRect.left + cardRect.width / 2;
    const startY = cardRect.top - shellRect.top + cardRect.height / 2;
    const targetX = barRect.left - shellRect.left + Math.min(barRect.width - 10, Math.max(10, barRect.width * 0.5));
    const targetY = barRect.top - shellRect.top + barRect.height / 2;

    const colors = ['#00e676', '#00e5ff', '#f5b700', '#ffffff'];

    for (let i = 0; i < 22; i++) {
      const spreadX = (Math.random() - 0.5) * cardRect.width * 0.7;
      const spreadY = (Math.random() - 0.5) * cardRect.height * 0.5;
      particles.push({
        x: startX + spreadX,
        y: startY + spreadY,
        sx: startX + spreadX,
        sy: startY + spreadY,
        cx: startX + spreadX * 1.6 + (Math.random() - 0.5) * 80,
        cy: startY - 60 - Math.random() * 90,
        tx: targetX + (Math.random() - 0.5) * 60,
        ty: targetY,
        t: 0,
        speed: 0.028 + Math.random() * 0.018,
        size: 3 + Math.random() * 3.5,
        color: colors[i % colors.length]
      });
    }

    if (!fxRaf) animateParticles();
  }

  function animateParticles() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    let arrived = false;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += p.speed;
      if (p.t >= 1) {
        particles.splice(i, 1);
        arrived = true;
        continue;
      }
      // Quadratic Bezier curve from card to XP bar
      const inv = 1 - p.t;
      p.x = inv * inv * p.sx + 2 * inv * p.t * p.cx + p.t * p.t * p.tx;
      p.y = inv * inv * p.sy + 2 * inv * p.t * p.cy + p.t * p.t * p.ty;

      fxCtx.save();
      fxCtx.shadowBlur = 10;
      fxCtx.shadowColor = p.color;
      fxCtx.fillStyle = p.color;
      fxCtx.globalAlpha = 1 - p.t * 0.25;
      fxCtx.beginPath();
      fxCtx.arc(p.x, p.y, p.size * (1 - p.t * 0.4), 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.restore();
    }

    if (arrived) {
      xpTrack.classList.add('pulse');
      setTimeout(() => xpTrack.classList.remove('pulse'), 180);
    }

    if (particles.length > 0) {
      fxRaf = requestAnimationFrame(animateParticles);
    } else {
      fxRaf = null;
    }
  }

  // =========================================================================
  // 4. AUDIO (US English TTS — Auto-Play Disabled) & SFX
  // =========================================================================
  let preferredVoice = null;
  let audioCtx = null;

  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      preferredVoice =
        voices.find(v => v.lang === 'en-US' && /Google|Samantha|Aria|Natural/i.test(v.name)) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en'));
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
  }

  function speakEnglish(text, rate = 0.95) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    if (preferredVoice) utter.voice = preferredVoice;
    window.speechSynthesis.speak(utter);
  }

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
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      }
    } catch { /* ignore */ }
  }

  // =========================================================================
  // 5. HELPERS & GAME LOOP
  // =========================================================================
  function getAdaptiveFontSize(text) {
    const len = text.length;
    if (len <= 12) return '2.25rem';
    if (len <= 24) return '1.8rem';
    if (len <= 42) return '1.45rem';
    if (len <= 60) return '1.22rem';
    return '1.08rem';
  }

  function getLevelInfo(totalXp) {
    let level = 1;
    let rem = totalXp;
    let need = 100;
    while (rem >= need) {
      rem -= need;
      level++;
      need = Math.round(100 * Math.pow(1.25, level - 1));
    }
    let rank = GTA_RANKS[0].name;
    for (const r of GTA_RANKS) if (level >= r.minLvl) rank = r.name;
    return { level, rem, need, rank };
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  let player = DataService.loadProfile();
  let currentCard = null;
  let isLocked = false;

  const arena = document.getElementById('arena');
  const cardMount = document.getElementById('cardMount');
  const reviewOverlay = document.getElementById('reviewOverlay');
  const dashboardModal = document.getElementById('dashboardModal');

  function updateHud() {
    const lvl = getLevelInfo(player.xp);
    document.getElementById('hudLevel').textContent = `LVL ${lvl.level}`;
    document.getElementById('hudXp').textContent = `${player.xp} XP`;
    document.getElementById('hudStreak').textContent = `🔥 ${player.streak}`;
    document.getElementById('xpFill').style.width = `${Math.min(100, (lvl.rem / lvl.need) * 100)}%`;
    document.getElementById('soundToggleBtn').textContent = player.soundEnabled ? '🔊' : '🔇';
  }

  async function renderNextCard() {
    const target = Math.min(6.0, Math.max(1.0, player.skillRating + N_PLUS_ONE_OFFSET));
    const pool = await DataService.getCandidatePool(target);

    if (pool.length === 0) {
      cardMount.innerHTML = `
        <div class="empty-state">
          No database files found.<br/><br/>
          Add <code>db/a1.jsonl</code> and serve via a local server.
        </div>`;
      return;
    }

    const entry = pickAdaptiveCard(pool, player);
    const isMatch = Math.random() < 0.5;
    const isAudioOnly = Math.random() < 0.32;

    currentCard = {
      ...entry,
      isMatch,
      isAudioOnly,
      shownThai: isMatch ? entry.th_correct : entry.th_wrong
    };

    const cardEl = document.createElement('div');
    cardEl.className = `card${isAudioOnly ? ' audio-mode' : ''}`;
    const enSize = getAdaptiveFontSize(currentCard.en);

    cardEl.innerHTML = `
      <div class="swipe-indicator match">✓</div>
      <div class="swipe-indicator nope">✕</div>

      <div class="card-top">
        ${isAudioOnly ? '<span class="audio-tag">🎧 AUDIO</span>' : ''}
      </div>

      <div class="en-zone">
        ${
          isAudioOnly
            ? `
              <button class="audio-btn hero" data-audio="normal" aria-label="Play audio">🔊</button>
              <button class="audio-btn slow" data-audio="slow" aria-label="Play slow">0.7x</button>
            `
            : `
              <div class="en-text" style="font-size:${enSize};">${escapeHtml(currentCard.en)}</div>
              <div class="audio-controls">
                <button class="audio-btn" data-audio="normal" aria-label="Play audio">🔊</button>
                <button class="audio-btn slow" data-audio="slow" aria-label="Play slow">0.7x</button>
              </div>
            `
        }
      </div>

      <div class="divider"></div>

      <div class="th-zone">
        <div class="th-text">${escapeHtml(currentCard.shownThai)}</div>
      </div>
    `;

    cardEl.querySelectorAll('[data-audio]').forEach(btn => {
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        speakEnglish(currentCard.en, btn.dataset.audio === 'slow' ? 0.7 : 0.95);
      });
    });

    attachSwipe(cardEl);
    cardMount.innerHTML = '';
    cardMount.appendChild(cardEl);
  }

  function attachSwipe(cardEl) {
    const indMatch = cardEl.querySelector('.swipe-indicator.match');
    const indNope = cardEl.querySelector('.swipe-indicator.nope');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;

    cardEl.addEventListener('pointerdown', e => {
      if (isLocked) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      cardEl.setPointerCapture(e.pointerId);
      cardEl.style.transition = '';
    });

    cardEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = (e.clientY - startY) * 0.2;
      cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${dx * 0.05}deg)`;

      const ratio = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
      indMatch.style.opacity = dx > 0 ? ratio : 0;
      indNope.style.opacity = dx < 0 ? ratio : 0;
    });

    const release = () => {
      if (!dragging) return;
      dragging = false;
      if (dx >= SWIPE_THRESHOLD) handleAnswer(true, cardEl);
      else if (dx <= -SWIPE_THRESHOLD) handleAnswer(false, cardEl);
      else {
        cardEl.style.transition = 'transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)';
        cardEl.style.transform = 'translate3d(0,0,0) rotate(0deg)';
        indMatch.style.opacity = 0;
        indNope.style.opacity = 0;
      }
    };

    cardEl.addEventListener('pointerup', release);
    cardEl.addEventListener('pointercancel', release);
  }

  function spawnXpPop(text) {
    const pop = document.createElement('div');
    pop.className = 'xp-pop';
    pop.textContent = text;
    arena.appendChild(pop);
    setTimeout(() => pop.remove(), 760);
  }

  function handleAnswer(swipedRight, cardEl) {
    if (isLocked || !currentCard) return;
    isLocked = true;

    const el = cardEl || cardMount.querySelector('.card');
    const isCorrect = swipedRight === currentCard.isMatch;

    player.totalAnswered++;
    player.recentKeys = [...player.recentKeys.slice(-20), currentCard.key];
    updateSkillRating(player, currentCard.difficulty, isCorrect, currentCard.isAudioOnly);

    if (isCorrect) {
      player.totalCorrect++;
      player.streak++;
      if (player.streak > player.bestStreak) player.bestStreak = player.streak;
      const base = currentCard.isAudioOnly ? 35 : 20;
      const earnedXp = Math.round(base * (player.streak >= 5 ? 1.5 : 1));
      player.xp += earnedXp;

      playSfx('correct');
      DataService.saveProfile(player);

      // Glow card + launch homing particles to XP bar (NO review overlay)
      if (el) {
        el.style.transition = 'transform 0.22s ease, opacity 0.28s ease 0.16s, box-shadow 0.2s';
        el.classList.add('glow-correct');
        el.style.transform = 'translate3d(0, -10px, 0) scale(1.03)';
        launchXpParticles(el);
        setTimeout(() => { el.style.opacity = '0'; }, 160);
      }

      spawnXpPop(`+${earnedXp} XP`);
      setTimeout(updateHud, 220);

      setTimeout(() => {
        isLocked = false;
        renderNextCard();
      }, 480);
    } else {
      player.streak = 0;
      playSfx('wrong');
      player.mistakes = [
        { en: currentCard.en, th: currentCard.th_correct },
        ...player.mistakes.filter(m => m.en !== currentCard.en)
      ].slice(0, 8);

      DataService.saveProfile(player);
      updateHud();

      if (el) {
        const dir = swipedRight ? 1 : -1;
        el.style.transition = 'transform 0.24s ease-in, opacity 0.24s ease-in';
        el.style.transform = `translate3d(${dir * 420}px, 24px, 0) rotate(${dir * 20}deg)`;
        el.style.opacity = '0';
      }

      showWrongReview();
    }
  }

  function showWrongReview() {
    document.getElementById('reviewEn').textContent = currentCard.en;
    document.getElementById('reviewThCorrect').textContent = currentCard.th_correct;

    const wrongEl = document.getElementById('reviewThWrong');
    if (!currentCard.isMatch) {
      wrongEl.textContent = currentCard.th_wrong;
      wrongEl.style.display = 'block';
    } else {
      wrongEl.style.display = 'none';
    }
    reviewOverlay.classList.add('show');
  }

  function closeReview() {
    if (!reviewOverlay.classList.contains('show')) return;
    reviewOverlay.classList.remove('show');
    isLocked = false;
    renderNextCard();
  }

  // =========================================================================
  // 6. CONTROLS & DASHBOARD
  // =========================================================================
  document.getElementById('reviewNextBtn').addEventListener('click', closeReview);
  document.getElementById('reviewAudioBtn').addEventListener('click', () => {
    if (currentCard) speakEnglish(currentCard.en, 0.95);
  });

  document.getElementById('btnNope').addEventListener('click', () => handleAnswer(false));
  document.getElementById('btnMatch').addEventListener('click', () => handleAnswer(true));
  document.getElementById('btnReplay').addEventListener('click', () => {
    if (currentCard) speakEnglish(currentCard.en, 0.95);
  });

  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    player.soundEnabled = !player.soundEnabled;
    DataService.saveProfile(player);
    updateHud();
  });

  function openDashboard() {
    const lvl = getLevelInfo(player.xp);
    const acc = player.totalAnswered ? Math.round((player.totalCorrect / player.totalAnswered) * 100) : 0;

    document.getElementById('statRank').textContent = lvl.rank;
    document.getElementById('statXp').textContent = player.xp;
    document.getElementById('statAcc').textContent = `${acc}%`;
    document.getElementById('statBestStreak').textContent = `🔥 ${player.bestStreak}`;

    const listEl = document.getElementById('mistakesList');
    listEl.innerHTML = player.mistakes.length
      ? player.mistakes.map(m => `<div class="mistake-item"><div class="en">${escapeHtml(m.en)}</div><div class="th">${escapeHtml(m.th)}</div></div>`).join('')
      : `<div style="color:var(--muted); font-size:0.84rem; text-align:center; padding:8px;">Clean record</div>`;

    dashboardModal.classList.add('open');
  }

  document.getElementById('openDashboardBtn').addEventListener('click', openDashboard);
  document.getElementById('statsBtn').addEventListener('click', openDashboard);
  document.getElementById('closeDashboardBtn').addEventListener('click', () => dashboardModal.classList.remove('open'));
  dashboardModal.addEventListener('click', e => {
    if (e.target === dashboardModal) dashboardModal.classList.remove('open');
  });

  document.getElementById('googleAuthBtn').addEventListener('click', () => DataService.signInWithGoogle());

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset progress?')) {
      localStorage.removeItem(STORAGE_KEY);
      player = DataService.loadProfile();
      updateHud();
      dashboardModal.classList.remove('open');
      renderNextCard();
    }
  });

  window.addEventListener('keydown', e => {
    if (dashboardModal.classList.contains('open')) return;
    if (reviewOverlay.classList.contains('show')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeReview();
      }
      return;
    }
    if (e.key === 'ArrowLeft') handleAnswer(false);
    else if (e.key === 'ArrowRight') handleAnswer(true);
    else if (e.key === ' ') {
      e.preventDefault();
      if (currentCard) speakEnglish(currentCard.en, 0.95);
    }
  });

  // Boot
  function init() {
    DataService.init();
    initVoices();
    resizeFx();
    window.addEventListener('resize', resizeFx);
    updateHud();
    renderNextCard();
  }

  init();
})();
