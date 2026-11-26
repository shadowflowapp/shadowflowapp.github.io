(() => {
  'use strict';

  // =========================================================================
  // 1. SUPABASE-READY CONFIGURATION & DATA SERVICE LAYER
  //    When migrating to Supabase:
  //    1) Include @supabase/supabase-js in index.html
  //    2) Set SUPABASE_CONFIG.enabled = true with your project URL & anonKey
  //    3) Map tables: `phrases`, `profiles`, `attempt_logs`
  // =========================================================================
  const SUPABASE_CONFIG = {
    enabled: false,
    url: '',
    anonKey: ''
  };

  const STORAGE_KEY = 'swipelago_adaptive_v2';
  const SWIPE_THRESHOLD = 85;
  const N_PLUS_ONE_OFFSET = 0.35; // Feeds content slightly above current skill

  const FALLBACK_DB = [
    { id: 1, cefr: 'A1', difficulty: 1.0, en: 'Water', th_correct: 'น้ำ', th_wrong: 'ไฟ' },
    { id: 2, cefr: 'A2', difficulty: 2.2, en: "I'm running late.", th_correct: 'ฉันกำลังจะไปสายแล้ว', th_wrong: 'ฉันกำลังวิ่งออกกำลังกาย' },
    { id: 3, cefr: 'B1', difficulty: 3.2, en: 'Give me a heads-up.', th_correct: 'ช่วยบอกล่วงหน้าด้วยนะ', th_wrong: 'ช่วยเงยหน้าขึ้นมองหน่อยนะ' },
    { id: 4, cefr: 'B2', difficulty: 4.2, en: 'Take a rain check.', th_correct: 'ขอเลื่อนไปคราวหน้านะ', th_wrong: 'ช่วยเช็กพยากรณ์อากาศหน่อย' },
    { id: 5, cefr: 'C1', difficulty: 5.0, en: 'Ubiquitous', th_correct: 'มีอยู่ทุกหนทุกแห่ง', th_wrong: 'หายากและมีค่ามาก' }
  ];

  const DataService = {
    supabase: null,

    init() {
      if (SUPABASE_CONFIG.enabled && window.supabase) {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      }
    },

    async signInWithGoogle() {
      if (!this.supabase) {
        alert('Supabase is not connected yet. Add your URL & anonKey in SUPABASE_CONFIG to enable Google Sign-In.');
        return null;
      }
      const { data, error } = await this.supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) console.error(error);
      return data;
    },

    async fetchPhrases() {
      if (this.supabase) {
        const { data, error } = await this.supabase.from('phrases').select('*');
        if (!error && data?.length) return data;
      }
      try {
        const res = await fetch('./db.jsonl');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        const rows = text.split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l));
        if (rows.length) return rows;
      } catch (e) {
        console.warn('Using fallback DB (serve via local HTTP server to load db.jsonl).', e);
      }
      return FALLBACK_DB;
    },

    loadProfile() {
      const defaults = {
        userId: null,
        xp: 0,
        skillRating: 1.5, // Continuous CEFR scale: 1.0 (A1) -> 6.0 (C2)
        streak: 0,
        bestStreak: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        soundEnabled: true,
        recentIds: [],
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
          total_correct: profile.totalCorrect,
          updated_at: new Date().toISOString()
        });
      }
    },

    async logAttempt(attempt) {
      if (this.supabase && attempt.userId) {
        await this.supabase.from('attempt_logs').insert(attempt);
      }
    }
  };

  // =========================================================================
  // 2. ADAPTIVE LEARNING ENGINE (n+1 / Elo-style Rating)
  // =========================================================================
  function ratingToCefr(rating) {
    if (rating < 2.0) return 'A1';
    if (rating < 3.0) return 'A2';
    if (rating < 4.0) return 'B1';
    if (rating < 5.0) return 'B2';
    if (rating < 5.75) return 'C1';
    return 'C2';
  }

  function selectAdaptivePhrase(phrases, profile) {
    const targetDifficulty = Math.min(6.0, Math.max(1.0, profile.skillRating + N_PLUS_ONE_OFFSET));
    const cooldown = new Set(profile.recentIds.slice(-8));

    let pool = phrases.filter(p => !cooldown.has(p.id));
    if (pool.length === 0) pool = phrases;

    // Score by closeness to n+1 target + slight random exploration
    const scored = pool.map(p => {
      const dist = Math.abs(p.difficulty - targetDifficulty);
      const jitter = Math.random() * 0.45;
      return { phrase: p, score: dist + jitter };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored[0].phrase;
  }

  function updateSkillRating(profile, cardDifficulty, isCorrect, isAudioOnly) {
    // Expected probability of answering correctly
    const expected = 1 / (1 + Math.pow(10, (cardDifficulty - profile.skillRating) / 1.5));
    const actual = isCorrect ? 1 : 0;
    const kFactor = isAudioOnly ? 0.32 : 0.24;
    const nextRating = profile.skillRating + kFactor * (actual - expected);
    profile.skillRating = Math.round(Math.min(6.0, Math.max(1.0, nextRating)) * 100) / 100;
  }

  // =========================================================================
  // 3. PARTICLE VISUAL EFFECTS (Correct Answer Burst)
  // =========================================================================
  const fxCanvas = document.getElementById('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');
  let particles = [];
  let fxRaf = null;

  function resizeFxCanvas() {
    const rect = fxCanvas.parentElement.getBoundingClientRect();
    fxCanvas.width = rect.width;
    fxCanvas.height = rect.height;
  }

  function burstParticles() {
    resizeFxCanvas();
    const cx = fxCanvas.width / 2;
    const cy = fxCanvas.height * 0.44;
    const colors = ['#10b981', '#34d399', '#f59e0b', '#22d3ee', '#ffffff'];

    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.3;
      const speed = 3 + Math.random() * 5.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 4,
        alpha: 1,
        color: colors[i % colors.length]
      });
    }

    if (!fxRaf) animateParticles();
  }

  function animateParticles() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.16; // subtle gravity
      p.alpha -= 0.025;
      fxCtx.globalAlpha = Math.max(0, p.alpha);
      fxCtx.fillStyle = p.color;
      fxCtx.beginPath();
      fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      fxCtx.fill();
    });
    particles = particles.filter(p => p.alpha > 0);
    fxCtx.globalAlpha = 1;

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
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(115, now + 0.18);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      }
    } catch { /* ignore */ }
  }

  // =========================================================================
  // 5. ADAPTIVE TYPOGRAPHY (1 to 10+ words)
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
    return { level, rem, need };
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  // =========================================================================
  // 6. CORE GAME LOOP & UI
  // =========================================================================
  let phrases = [];
  let player = DataService.loadProfile();
  let currentCard = null;
  let isReviewing = false;
  let reviewTimer = null;

  const cardMount = document.getElementById('cardMount');
  const reviewOverlay = document.getElementById('reviewOverlay');
  const reviewTimerBar = document.getElementById('reviewTimerBar');
  const reviewTimerFill = document.getElementById('reviewTimerFill');
  const dashboardModal = document.getElementById('dashboardModal');

  function updateHud() {
    const lvl = getLevelInfo(player.xp);
    document.getElementById('hudCefr').textContent = ratingToCefr(player.skillRating);
    document.getElementById('hudLevel').textContent = `LVL ${lvl.level}`;
    document.getElementById('hudStreak').textContent = `🔥 ${player.streak}`;
    document.getElementById('xpFill').style.width = `${Math.min(100, (lvl.rem / lvl.need) * 100)}%`;
    document.getElementById('soundToggleBtn').textContent = player.soundEnabled ? '🔊' : '🔇';
  }

  function renderNextCard() {
    const entry = selectAdaptivePhrase(phrases, player);
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
        <span class="badge">${currentCard.cefr}</span>
        ${isAudioOnly ? '<span class="badge audio">🎧</span>' : ''}
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

    // Audio buttons (manual tap only — no auto-play)
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
      if (isReviewing) return;
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

  function handleAnswer(swipedRight, cardEl) {
    if (isReviewing || !currentCard) return;
    isReviewing = true;

    const el = cardEl || cardMount.querySelector('.card');
    if (el) {
      const dir = swipedRight ? 1 : -1;
      el.style.transition = 'transform 0.24s ease-in, opacity 0.24s ease-in';
      el.style.transform = `translate3d(${dir * 420}px, 24px, 0) rotate(${dir * 20}deg)`;
      el.style.opacity = '0';
    }

    const isCorrect = swipedRight === currentCard.isMatch;
    player.totalAnswered++;
    player.recentIds = [...player.recentIds.slice(-15), currentCard.id];

    updateSkillRating(player, currentCard.difficulty, isCorrect, currentCard.isAudioOnly);

    let earnedXp = 0;
    if (isCorrect) {
      player.totalCorrect++;
      player.streak++;
      if (player.streak > player.bestStreak) player.bestStreak = player.streak;
      const base = currentCard.isAudioOnly ? 35 : 20;
      earnedXp = Math.round(base * (player.streak >= 5 ? 1.5 : 1));
      player.xp += earnedXp;
      playSfx('correct');
      burstParticles();
    } else {
      player.streak = 0;
      playSfx('wrong');
      player.mistakes = [
        { en: currentCard.en, th: currentCard.th_correct },
        ...player.mistakes.filter(m => m.en !== currentCard.en)
      ].slice(0, 8);
    }

    DataService.saveProfile(player);
    DataService.logAttempt({
      userId: player.userId,
      phraseId: currentCard.id,
      isCorrect,
      isAudioOnly: currentCard.isAudioOnly,
      skillAfter: player.skillRating,
      createdAt: new Date().toISOString()
    });

    updateHud();
    showReview(isCorrect, earnedXp);
  }

  function showReview(isCorrect, earnedXp) {
    clearTimeout(reviewTimer);
    reviewOverlay.className = `review-overlay show ${isCorrect ? 'correct' : 'wrong'}`;

    document.getElementById('reviewStatus').textContent = isCorrect
      ? `✓ Correct  +${earnedXp} XP`
      : '✕ Not quite';

    document.getElementById('reviewEn').textContent = currentCard.en;
    document.getElementById('reviewThCorrect').textContent = currentCard.th_correct;

    const wrongEl = document.getElementById('reviewThWrong');
    if (!currentCard.isMatch) {
      wrongEl.textContent = currentCard.th_wrong;
      wrongEl.style.display = 'block';
    } else {
      wrongEl.style.display = 'none';
    }

    // Correct: auto-advance after 2.2s (or tap immediately). Wrong: wait for user tap.
    if (isCorrect) {
      reviewTimerBar.style.display = 'block';
      reviewTimerFill.style.transition = 'none';
      reviewTimerFill.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => {
        reviewTimerFill.style.transition = 'transform 2.2s linear';
        reviewTimerFill.style.transform = 'scaleX(0)';
      });
      reviewTimer = setTimeout(closeReviewAndAdvance, 2200);
    } else {
      reviewTimerBar.style.display = 'none';
    }
  }

  function closeReviewAndAdvance() {
    if (!isReviewing) return;
    clearTimeout(reviewTimer);
    reviewOverlay.classList.remove('show');
    isReviewing = false;
    renderNextCard();
  }

  // =========================================================================
  // 7. EVENTS & DASHBOARD
  // =========================================================================
  document.getElementById('reviewNextBtn').addEventListener('click', e => {
    e.stopPropagation();
    closeReviewAndAdvance();
  });

  reviewOverlay.addEventListener('click', closeReviewAndAdvance);

  document.getElementById('reviewAudioBtn').addEventListener('click', e => {
    e.stopPropagation();
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
    const acc = player.totalAnswered ? Math.round((player.totalCorrect / player.totalAnswered) * 100) : 0;
    document.getElementById('statCefr').textContent = `${ratingToCefr(player.skillRating)} (${player.skillRating.toFixed(1)})`;
    document.getElementById('statXp').textContent = player.xp;
    document.getElementById('statAcc').textContent = `${acc}%`;
    document.getElementById('statBestStreak').textContent = `🔥 ${player.bestStreak}`;

    const listEl = document.getElementById('mistakesList');
    listEl.innerHTML = player.mistakes.length
      ? player.mistakes.map(m => `<div class="mistake-item"><div class="en">${escapeHtml(m.en)}</div><div class="th">${escapeHtml(m.th)}</div></div>`).join('')
      : `<div style="color:var(--muted); font-size:0.84rem; text-align:center; padding:8px;">No mistakes yet</div>`;

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
    if (isReviewing) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeReviewAndAdvance();
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
  async function init() {
    DataService.init();
    initVoices();
    resizeFxCanvas();
    window.addEventListener('resize', resizeFxCanvas);
    updateHud();
    phrases = await DataService.fetchPhrases();
    renderNextCard();
  }

  init();
})();
