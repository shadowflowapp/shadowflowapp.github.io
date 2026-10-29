let db = []; 
let shuffledIndices = [];
let currentIndex = 0; 
let wordsCleared = 0; 
let xpScore = 0; 

// --- SPEECH SYNTHESIS ---
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google'))) || voices.find(v => v.lang === 'en-US');
};

// --- JS AUTO-SCALER ---
function fitText(elementId, maxRem) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let currentRem = maxRem;
    el.style.fontSize = currentRem + 'rem';
    while (el.scrollWidth > el.parentElement.clientWidth && currentRem > 1) {
        currentRem -= 0.15;
        el.style.fontSize = currentRem + 'rem';
    }
}

async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        let storedOrder = localStorage.getItem('aaa_order');
        if (storedOrder) {
            shuffledIndices = JSON.parse(storedOrder);
            if(shuffledIndices.length !== db.length) {
                shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
                localStorage.setItem('aaa_order', JSON.stringify(shuffledIndices));
            }
        } else {
            shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
            localStorage.setItem('aaa_order', JSON.stringify(shuffledIndices));
        }

        if (localStorage.getItem('aaa_cleared')) wordsCleared = parseInt(localStorage.getItem('aaa_cleared'));
        if (localStorage.getItem('aaa_xp')) xpScore = parseInt(localStorage.getItem('aaa_xp'));
        
        currentIndex = wordsCleared; 
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR LOADING DATA";
    }
}

// --- SOUND ENGINEERING ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSynthBeep(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

function playHitSound() {
    playSynthBeep(1200, 'sine', 0.1, 0.2);
    setTimeout(() => playSynthBeep(1800, 'sine', 0.1, 0.2), 50);
}
function playDamageSound() {
    playSynthBeep(150, 'sawtooth', 0.2, 0.3);
}

function playAudio(word = null) {
    if (db.length === 0) return;
    synth.cancel(); // STRICT CANCEL to prevent overlaps
    const textToSpeak = word || db[shuffledIndices[currentIndex]].w;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; synth.speak(utterance);
}

// --- UI & NAVIGATION ---
function updateXPDisplay() {
    // Animate the score counting up would be nice, but instant is fine for MVP
    document.getElementById('xp-box').innerText = xpScore.toLocaleString();
}

function updateUI() {
    if (db.length === 0 || currentIndex >= db.length) return;
    const currentWord = db[shuffledIndices[currentIndex]];
    
    document.getElementById('word').innerText = currentWord.w;
    document.getElementById('thai').innerText = currentWord.t;
    
    updateXPDisplay();
    fitText('word', 4.5);
    fitText('thai', 3.5);
    
    let batchPos = (currentIndex % 10) + 1;
    document.getElementById('global-progress-fill').style.width = `${(wordsCleared / db.length) * 100}%`;

    const backBtn = document.getElementById('back-btn');
    // Hide PREV button if they are at the start of their un-cleared batch
    if (currentIndex === wordsCleared) {
        backBtn.style.visibility = 'hidden';
    } else {
        backBtn.style.visibility = 'visible';
    }

    const nextBtn = document.getElementById('next-btn');
    if (batchPos === 10) {
        nextBtn.innerText = "ENGAGE ⚔️";
        nextBtn.classList.add('quiz-ready');
    } else {
        nextBtn.innerText = "NEXT";
        nextBtn.classList.remove('quiz-ready');
    }
}

function prevWord() {
    synth.cancel(); 
    if (currentIndex > wordsCleared) {
        currentIndex--;
        updateUI();
        playAudio();
    }
}

function nextWord() {
    synth.cancel(); 
    if (currentIndex < db.length) {
        if ((currentIndex + 1) % 10 === 0 && currentIndex - wordsCleared === 9) {
            startGauntlet();
            return;
        }
        currentIndex++;
        updateUI();
        playAudio(); 
    }
}

// --- SWIPE CONTROLS ---
let touchstartX = 0; let touchendX = 0;
document.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    if (document.getElementById('quiz-container').style.display !== 'flex' && !document.getElementById('custom-modal').classList.contains('show')) {
        if (touchendX < touchstartX - 50) nextWord();
        if (touchendX > touchstartX + 50) prevWord();
    }
}, {passive: true});
document.addEventListener('keydown', e => {
    if (document.getElementById('quiz-container').style.display !== 'flex' && !document.getElementById('custom-modal').classList.contains('show')) {
        if (e.key === 'ArrowRight') nextWord();
        if (e.key === 'ArrowLeft') prevWord();
    }
});

// --- MODAL ---
let modalCallback = null;
function showModal(title, desc, buttonText, callback) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    document.querySelector('.modal-btn').innerText = buttonText;
    modalCallback = callback;
    document.getElementById('custom-modal').classList.add('show');
}
function closeModal() {
    document.getElementById('custom-modal').classList.remove('show');
    if (modalCallback) { modalCallback(); modalCallback = null; }
}

// --- THE ENGAGEMENT ZONE (Quiz) ---
let gauntletTimer;
let gauntletEndTime;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};
let isBlindAudio = false;
let attemptsLeft = 2; 

function triggerDamageFlash() {
    const overlay = document.getElementById('damage-overlay');
    overlay.classList.add('taking-damage');
    setTimeout(() => overlay.classList.remove('taking-damage'), 150);
}

// FLOATING XP PARTICLE EFFECT
function spawnXPPop(amount, btnElement, isCrit) {
    const rect = btnElement.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = isCrit ? 'xp-pop crit' : 'xp-pop';
    popup.innerText = `+${amount} XP`;
    // Spawn at the center of the clicked button
    popup.style.left = (rect.left + rect.width / 2) + 'px';
    popup.style.top = rect.top + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1000); // Clean up DOM
}

function startGauntlet() {
    document.getElementById('quiz-container').style.display = 'flex';
    playSynthBeep(400, 'square', 0.2); 

    const batchIndices = shuffledIndices.slice(wordsCleared, wordsCleared + 10);
    quizBatchQueue = batchIndices.map(i => db[i]).sort(() => Math.random() - 0.5);

    document.getElementById('timer-text').innerText = "ENGAGING...";
    fitText('timer-text', 4.5); // Ensure "ENGAGING" fits perfectly
    
    document.getElementById('quiz-word').innerHTML = "";
    document.getElementById('quiz-options').innerHTML = '';
    
    setTimeout(() => {
        currentQuestionIndex = 0;
        gauntletEndTime = Date.now() + (MAX_TIME * 1000);
        generateQuizQuestion();
        
        gauntletTimer = setInterval(() => {
            let timeLeft = (gauntletEndTime - Date.now()) / 1000;
            if(timeLeft <= 0) timeLeft = 0;
            
            document.getElementById('timer-text').innerText = timeLeft.toFixed(1);
            if(timeLeft < 5.0 && timeLeft > 0 && Math.floor(timeLeft * 10) % 10 === 0) playSynthBeep(800, 'sine', 0.05, 0.05);

            if (timeLeft <= 0) failGauntlet("TIME EXPIRED");
        }, 100);
    }, 800);
}

function playQuizAudio() { synth.cancel(); playAudio(currentQuizWord.w); }

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    attemptsLeft = 2; 
    isBlindAudio = Math.random() < 0.3;

    if (isBlindAudio) {
        document.getElementById('quiz-word').innerHTML = `<span style="color: #66fcf1; opacity: 0.5;">[ ■ ■ ■ ]</span>`;
    } else {
        document.getElementById('quiz-word').innerHTML = currentQuizWord.w;
        fitText('quiz-word', 4.0);
    }
    
    playQuizAudio();
    
    let options = [currentQuizWord.t];
    let attempts = 0; 
    while(options.length < 4 && attempts < 1000) {
        attempts++;
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
        let isExactMatch = options.includes(randomWrong);
        let isTooSimilar = options.some(opt => opt.includes(randomWrong) || randomWrong.includes(opt));
        if(!isExactMatch && !isTooSimilar) options.push(randomWrong);
    }
    while (options.length < 4) options.push(db[Math.floor(Math.random() * db.length)].t + " ");
    
    options.sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';
    
    options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = `quiz-option opt-${index}`; 
        btn.innerText = opt.trim();
        btn.onclick = (e) => checkAnswer(opt, e.currentTarget);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedThai, buttonElement) {
    let timeLeft = (gauntletEndTime - Date.now()) / 1000;
    if(timeLeft < 0) timeLeft = 0;

    if (selectedThai === currentQuizWord.t) {
        // CORRECT
        Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');
        playHitSound(); 
        buttonElement.classList.add('correct');
        
        // Calculate XP
        let wordBaseXp = 100;
        let speedBonus = Math.floor((timeLeft / MAX_TIME) * 50); 
        let totalGain = wordBaseXp + speedBonus;
        if (isBlindAudio) totalGain *= 2; 
        if (attemptsLeft === 1) totalGain = Math.floor(totalGain / 2); // 50% penalty if missed once
        
        xpScore += totalGain;
        updateXPDisplay();
        
        // Spawn Floating Visual
        spawnXPPop(totalGain, buttonElement, isBlindAudio);

        if (isBlindAudio) {
            document.getElementById('quiz-word').innerHTML = `<span style="color: #66fcf1;">${currentQuizWord.w.toUpperCase()}</span>`;
            fitText('quiz-word', 4.0);
        }
        
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) passGauntlet();
            else generateQuizQuestion();
        }, 500);

    } else {
        // WRONG 
        attemptsLeft--;
        playDamageSound();
        triggerDamageFlash();
        buttonElement.classList.add('wrong');
        
        xpScore -= 50; // XP Penalty
        if(xpScore < 0) xpScore = 0;
        updateXPDisplay();

        if (attemptsLeft <= 0) {
            Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');
            setTimeout(() => { failGauntlet("MISSION FAILED"); }, 400);
        }
    }
}

function passGauntlet() {
    clearInterval(gauntletTimer);
    document.getElementById('quiz-container').style.display = 'none';
    
    // Confetti Victory
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#66fcf1', '#ff007f', '#ffffff'] });

    wordsCleared += 10; 
    currentIndex = wordsCleared; 
    
    localStorage.setItem('aaa_cleared', wordsCleared);
    localStorage.setItem('aaa_xp', xpScore);
    
    if (wordsCleared >= db.length) {
        showModal("GAME CLEARED", "ALL WORDS MASTERED.", "RESTART", () => {
            wordsCleared = 0; currentIndex = 0; xpScore = 0;
            localStorage.setItem('aaa_cleared', 0); localStorage.setItem('aaa_xp', 0); updateUI();
        });
    } else {
        updateUI();
        playAudio(); 
    }
}

function failGauntlet(reason) {
    clearInterval(gauntletTimer);
    showModal("DEFEAT", reason + "\nTRY AGAIN.", "RETRY", () => {
        document.getElementById('quiz-container').style.display = 'none';
        
        currentIndex = wordsCleared; 
        localStorage.setItem('aaa_xp', xpScore); 
        
        updateUI();
        playAudio();
    });
}

initApp();
