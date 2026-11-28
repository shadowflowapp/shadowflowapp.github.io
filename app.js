(() => {
  'use strict';

  const SUPABASE_CONFIG = {
    enabled: false,
    url: '',
    anonKey: ''
  };

  const STORAGE_KEY = 'swipelago_listen_v4';
  const SWIPE_THRESHOLD = 85;
  const CORRECT_REVEAL_MS = 1150; // Gives user time to see the English phrase on correct swipe

  // =========================================================================
  // 1. DATA SERVICE (Multi-file db/*.jsonl via manifest.json + Supabase RPC)
  // =========================================================================
  const DataService = {
    supabase: null,
    allItems: [],

    init() {
      if (SUPABASE_CONFIG.enabled && window.supabase) {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      }
    },

    async signInWithGoogle() {
      if (!this.supabase) {
        alert('Add your Supabase URL & anonKey in SUPABASE_CONFIG to enable Google Sign-In.');
        return;
      }
      await this.supabase.auth.signInWithOAuth({ provider: 'google' });
    },

    async loadDatabase() {
      // Production Supabase mode: secure RPC returns only small unmastered batches
      if (this.supabase) {
        const { data, error } = await this.supabase.rpc('get_next_cards', { batch_size: 20 });
        if (!error && data?.length) {
          this.allItems = data;
          return this.allItems;
        }
      }

      // Static mode: reads db/manifest.json and loads all listed .jsonl files
      try {
        const manifestRes = await fetch('./db/manifest.json');
        if (!manifestRes.ok) throw new Error('Missing db/manifest.json');
        const files = await manifestRes.json();

        const loadedArrays = await Promise.all(
          files.map(async file => {
            try {
              const res = await fetch(`./db/${file}`);
              if (!res.ok) return [];
              const text = await res.text();
              return text
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean)
                .map(line => JSON.parse(line));
            } catch {
              return [];
            }
          })
        );

        // Deduplicate by exact English text so daily additions never duplicate
        const map = new Map();
        loadedArrays.flat().forEach(item => {
          if (item?.en && !map.has(item.en)) map.set(item.en, item);
        });

        this.allItems = Array.from(map.values());
        return this.allItems;
      } catch (err) {
        console.error('Database load error:', err);
        this.allItems = [];
        return [];
      }
    },

    loadProfile() {
      const defaults = {
        userId: null,
        mastered: [], // Array of mastered `en` keys
        streak: 0,
        bestStreak: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        soundEnabled: true,
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
    },

    async markMastered(profile, item) {
      if (!profile.mastered.includes(item.en)) {
        profile.mastered.push(item.en);
      }
      await this.saveProfile(profile);

      if (this.supabase && profile.userId && item.id) {
        await this.supabase.from('user_mastery').upsert({
          user_id: profile.userId,
          item_id: item.id
        });
      }
    }
  };

  // =========================================================================
  // 2. HOMING PARTICLES (Glowing Card -> Mastery Bar)
  // =========================================================================
  const phoneShell = document.getElementById('phoneShell');
  const fxCanvas = document.getElementById('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');
  const progressTrack = document.getElementById('progressTrack');
  let particles = [];
  let fxRaf = null;

  function resizeFx() {
    const r = phoneShell.getBoundingClientRect();
    fxCanvas.width = r.width;
    fxCanvas.height = r.height;
  }

  function launchMasteryParticles(fromEl) {
    resizeFx();
    const shellRect = phoneShell.getBoundingClientRect();
    const cardRect = fromEl.getBoundingClientRect();
    const barRect = progressTrack.getBoundingClientRect();

    const startX = cardRect.left - shellRect.left + cardRect.width / 2;
    const startY = cardRect.top - shellRect.top + cardRect.height / 2;
    const targetX = barRect.left - shellRect.left + barRect.width * 0.35;
    const targetY = barRect.top - shellRect.top + barRect.height / 2;
    const colors = ['#00e676', '#00e5ff', '#f5b700', '#ffffff'];

    for (let i = 0; i < 24; i++) {
      const sx = startX + (Math.random() - 0.5) * cardRect.width * 0.7;
      const sy = startY + (Math.random() - 0.5) * cardRect.height * 0.5;
      particles.push({
        sx,
        sy,
        cx: sx + (Math.random() - 0.5) * 140,
        cy: sy - 70 - Math.random() * 100,
        tx: targetX + (Math.random() - 0.5) * 80,
        ty: targetY,
        t: 0,
        speed: 0.026 + Math.random() * 0.016,
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
      const inv = 1 - p.t;
      const x = inv * inv * p.sx + 2 * inv * p.t * p.cx + p.t * p.t * p.tx;
      const y = inv * inv * p.sy + 2 * inv * p.t * p.cy + p.t * p.t * p.ty;

      fxCtx.save();
      fxCtx.shadowBlur = 10;
      fxCtx.shadowColor = p.color;
      fxCtx.fillStyle = p.color;
      fxCtx.globalAlpha = 1 - p.t * 0.25;
      fxCtx.beginPath();
      fxCtx.arc(x, y, p.size * (1 - p.t * 0.35), 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.restore();
    }

    if (arrived) {
      progressTrack.classList.add('pulse');
      setTimeout(() => progressTrack.classList.remove('pulse'), 180);
    }

    if (particles.length > 0) {
      fxRaf = requestAnimationFrame(animateParticles);
    } else {
      fxRaf = null;
    }
  }

  // =========================================================================
  // 3. AUDIO (US English TTS — Manual Tap Only) & SFX
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

  function speakEnglish(text, rate = 0.95, btnEl = null) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    if (preferredVoice) utter.voice = preferredVoice;

    if (btnEl) {
      btnEl.classList.add('playing');
      utter.onend = () => btnEl.classList.remove('playing');
      utter.onerror = () => btnEl.classList.remove('playing');
    }

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
  // 4. ADAPTIVE TYPOGRAPHY & HELPERS
  // =========================================================================
  function getAdaptiveFontSize(text) {
    const len = text.length;
    if (len <= 12) return '2.2rem';
    if (len <= 24) return '1.75rem';
    if (len <= 42) return '1.4rem';
    if (len <= 60) return '1.2rem';
    return '1.05rem';
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  // =========================================================================
  // 5. PURE RANDOM UNMASTERED FEED & GAME LOOP
  // =========================================================================
  let player = DataService.loadProfile();
  let currentCard = null;
  let lastServedEn = null;
  let isLocked = false;

  const cardMount = document.getElementById('cardMount');
  const reviewOverlay = document.getElementById('reviewOverlay');
  const dashboardModal = document.getElementById('dashboardModal');

  function getUnmasteredPool() {
    const masteredSet = new Set(player.mastered);
    return DataService.allItems.filter(item => !masteredSet.has(item.en));
  }

  function updateHud() {
    const total = DataService.allItems.length;
    const masteredCount = player.mastered.length;
    const pct = total > 0 ? Math.min(100, (masteredCount / total) * 100) : 0;

    document.getElementById('hudMastered').textContent = `${masteredCount} MASTERED`;
    document.getElementById('hudStreak').textContent = `🔥 ${player.streak}`;
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('soundToggleBtn').textContent = player.soundEnabled ? '🔊' : '🔇';
  }

  function renderNextCard() {
    if (DataService.allItems.length === 0) {
      cardMount.innerHTML = `
        <div class="empty-state">
          Add <code>db/manifest.json</code> and <code>db/batch_001.jsonl</code>,<br/>
          then run via a local HTTP server.
        </div>`;
      return;
    }

    let pool = getUnmasteredPool();
    if (pool.length === 0) {
      cardMount.innerHTML = `
        <div class="empty-state">
          <h3>VAULT CLEARED</h3>
          <div>All ${DataService.allItems.length} entries mastered.</div>
          <button class="next-btn" id="replayAllBtn" style="margin-top:8px;">Reset & Practice Again</button>
        </div>`;
      document.getElementById('replayAllBtn').addEventListener('click', () => {
        player.mastered = [];
        DataService.saveProfile(player);
        updateHud();
        renderNextCard();
      });
      return;
    }

    // Avoid repeating the exact same card back-to-back if pool > 1
    if (pool.length > 1 && lastServedEn) {
      pool = pool.filter(item => item.en !== lastServedEn);
    }

    const entry = pool[Math.floor(Math.random() * pool.length)];
    lastServedEn = entry.en;
    const isMatch = Math.random() < 0.5;

    currentCard = {
      ...entry,
      isMatch,
      shownThai: isMatch ? entry.th_correct : entry.th_wrong
    };

    const cardEl = document.createElement('div');
    cardEl.className = 'card';

    cardEl.innerHTML = `
      <div class="swipe-indicator match">✓</div>
      <div class="swipe-indicator nope">✕</div>

      <div class="audio-zone" id="cardAudioZone">
        <button class="audio-btn hero" data-audio="normal" aria-label="Listen">🔊</button>
        <button class="audio-btn slow" data-audio="slow" aria-label="Slow">0.7x</button>
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
        const heroBtn = cardEl.querySelector('.audio-btn.hero');
        speakEnglish(currentCard.en, btn.dataset.audio === 'slow' ? 0.7 : 0.95, heroBtn);
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

  function handleAnswer(swipedRight, cardEl) {
    if (isLocked || !currentCard) return;
    isLocked = true;

    const el = cardEl || cardMount.querySelector('.card');
    const isCorrect = swipedRight === currentCard.isMatch;
    player.totalAnswered++;

    if (isCorrect) {
      player.totalCorrect++;
      player.streak++;
      if (player.streak > player.bestStreak) player.bestStreak = player.streak;

      playSfx('correct');
      DataService.markMastered(player, currentCard);

      // Glow card, reveal English phrase visually, and launch particles to HUD bar
      if (el) {
        const audioZone = el.querySelector('#cardAudioZone');
        const fontSize = getAdaptiveFontSize(currentCard.en);
        if (audioZone) {
          audioZone.innerHTML = `<div class="en-reveal" style="font-size:${fontSize};">${escapeHtml(currentCard.en)}</div>`;
        }
        el.style.transition = 'transform 0.22s ease, opacity 0.28s ease, box-shadow 0.2s';
        el.classList.add('glow-correct');
        el.style.transform = 'translate3d(0, -8px, 0) scale(1.02)';
        launchMasteryParticles(el);

        setTimeout(() => { el.style.opacity = '0'; }, CORRECT_REVEAL_MS - 260);
      }

      setTimeout(updateHud, 250);
      setTimeout(() => {
        isLocked = false;
        renderNextCard();
      }, CORRECT_REVEAL_MS);
    } else {
      player.streak = 0;
      playSfx('wrong');
      player.mistakes = [
        { en: currentCard.en, th: currentCard.th_correct },
        ...player.mistakes.filter(m => m.en !== currentCard.en)
      ].slice(0, 10);

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
    const enEl = document.getElementById('reviewEn');
    enEl.textContent = currentCard.en;
    enEl.style.fontSize = getAdaptiveFontSize(currentCard.en);

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
    if (!currentCard) return;
    const heroBtn = cardMount.querySelector('.audio-btn.hero');
    speakEnglish(currentCard.en, 0.95, heroBtn);
  });

  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    player.soundEnabled = !player.soundEnabled;
    DataService.saveProfile(player);
    updateHud();
  });

  function openDashboard() {
    const total = DataService.allItems.length;
    const mastered = player.mastered.length;
    const remaining = Math.max(0, total - mastered);
    const acc = player.totalAnswered ? Math.round((player.totalCorrect / player.totalAnswered) * 100) : 0;

    document.getElementById('statMastered').textContent = mastered;
    document.getElementById('statRemaining').textContent = remaining;
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
    if (confirm('Reset all mastered progress?')) {
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
      if (currentCard) {
        const heroBtn = cardMount.querySelector('.audio-btn.hero');
        speakEnglish(currentCard.en, 0.95, heroBtn);
      }
    }
  });

  // Boot
  async function init() {
    DataService.init();
    initVoices();
    resizeFx();
    window.addEventListener('resize', resizeFx);
    await DataService.loadDatabase();
    updateHud();
    renderNextCard();
  }

  init();
})();
