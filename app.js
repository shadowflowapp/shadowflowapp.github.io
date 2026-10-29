let db = []; 
let shuffledIndices = [];
let currentIndex = 0; 
let wordsCleared = 0; // Tracks DB progress
let xpScore = 0; // Tactical XP Score

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
        currentRem -= 0.2;
        el.style.fontSize = currentRem + 'rem';
    }
}

async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        let storedOrder = localStorage.getItem('tac_order');
        if (storedOrder) {
            shuffledIndices = JSON.parse(storedOrder);
            if(shuffledIndices.length !== db.length) {
                shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
                localStorage.setItem('tac_order', JSON.stringify(shuffledIndices));
            }
        } else {
            shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
            localStorage.setItem('tac_order', JSON.stringify(shuffledIndices));
        }

        if (localStorage.getItem('tac_cleared')) wordsCleared = parseInt(localStorage.getItem('tac_cleared'));
        if (localStorage.getItem('tac_xp')) xpScore = parseInt(localStorage.getItem('tac_xp'));
        
        currentIndex = wordsCleared; 
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "DATA CORRUPTION";
    }
}

// --- TACTICAL SOUND ENGINEERING (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTacBeep(freq, type, duration, vol=0.1) {
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

// CoD Hit-marker sound (Correct)
function playHitMarker() {
    playTacBeep(4000, 'square', 0.05, 0.05);
    setTimeout(() => playTacBeep(6000, 'sine', 0.05, 0.05), 20);
}

// Damage/Armor hit sound (Wrong)
function playDamageThud() {
    playTacBeep(150, 'sawtooth', 0.3, 0.3);
    setTimeout(() => playTacBeep(100, 'square', 0.2, 0.4), 50);
}

function playAudio(word = null) {
    if (db.length === 0) return;
    synth.cancel(); // STRICT CANCEL to prevent overlaps
    const textToSpeak = word || db[shuffledIndices[currentIndex]].w;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; synth.speak(utterance);
}

// --- UI UPDATES ---
function updateXPDisplay() {
    // Format XP with leading zeros (e.g. 00450)
    document.getElementById('xp-box').innerText = xpScore.toString().padStart(5, '0');
}

function updateUI() {
    if (db.length === 0 || currentIndex >= db.length) return;
    const currentWord = db[shuffledIndices[currentIndex]];
    
    document.getElementById('word').innerText = currentWord.w.toUpperCase();
    document.getElementById('ipa').innerText = currentWord.i || "";
    document.getElementById('pos').innerText = currentWord.p;
    document.getElementById('thai').innerText = currentWord.t;
    
    updateXPDisplay();
    document.getElementById('progress-text').innerText = `${wordsCleared} / ${db.length}`;
    
    fitText('word', 4.5);
    fitText('thai', 3.5);
    
    let batchPos = (currentIndex % 10) + 1;
    document.getElementById('global-progress-fill').style.width = `${(wordsCleared / db.length) * 100}%`;

    const nextBtn = document.getElementById('next-btn');
    if (batchPos === 10) {
        nextBtn.innerText = "ENGAGE ⚔️";
        nextBtn.classList.add('quiz-ready');
    } else {
        nextBtn.innerText = "[ NEXT ]";
        nextBtn.classList.remove('quiz-ready');
    }
}

function prevWord() {
    synth.cancel(); // Force stop current audio immediately
    if (currentIndex > wordsCleared) {
        currentIndex--;
        updateUI();
        playAudio(); // Auto-play the new word
    }
}

function nextWord() {
    synth.cancel(); // Force stop current audio immediately
    if (currentIndex < db.length) {
        if ((currentIndex + 1) % 10 === 0 && currentIndex - wordsCleared === 9) {
            startGauntlet();
            return;
        }
        currentIndex++;
        updateUI();
        playAudio(); // Auto-play the new word
    }
}

// --- SWIPE & KEYBOARD ---
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

// --- THE ENGAGEMENT ZONE (CoD Quiz) ---
let gauntletTimer;
let gauntletEndTime;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};
let isBlindAudio = false;
let attemptsLeft = 2; // ARMOR SYSTEM

function triggerDamageFlash() {
    const overlay = document.getElementById('damage-overlay');
    overlay.classList.add('taking-damage');
    setTimeout(() => overlay.classList.remove('taking-damage'), 150);
}

function startGauntlet() {
    document.getElementById('quiz-container').style.display = 'flex';
    playTacBeep(300, 'square', 0.1); setTimeout(() => playTacBeep(400, 'square', 0.2), 150); // Start Beep

    const batchIndices = shuffledIndices.slice(wordsCleared, wordsCleared + 10);
    quizBatchQueue = batchIndices.map(i => db[i]).sort(() => Math.random() - 0.5);

    document.getElementById('timer-text').innerText = "ENGAGING...";
    document.getElementById('quiz-word').innerHTML = "";
    document.getElementById('quiz-pos').innerText = "";
    document.getElementById('quiz-options').innerHTML = '';
    
    setTimeout(() => {
        currentQuestionIndex = 0;
        gauntletEndTime = Date.now() + (MAX_TIME * 1000);
        generateQuizQuestion();
        
        gauntletTimer = setInterval(() => {
            let timeLeft = (gauntletEndTime - Date.now()) / 1000;
            if(timeLeft <= 0) timeLeft = 0;
            
            document.getElementById('timer-text').innerText = timeLeft.toFixed(1);
            if(timeLeft < 5.0 && timeLeft > 0 && Math.floor(timeLeft * 10) % 10 === 0) playTacBeep(800, 'sine', 0.05, 0.05);

            if (timeLeft <= 0) failGauntlet("TIME EXPIRED");
        }, 100);
    }, 800);
}

function playQuizAudio() { synth.cancel(); playAudio(currentQuizWord.w); }

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    attemptsLeft = 2; // Reset armor
    isBlindAudio = Math.random() < 0.3;

    if (isBlindAudio) {
        // EMPTY BRACKETS FOR CLASSIFIED AUDIO (No Text!)
        document.getElementById('quiz-word').innerHTML = `<span style="color: #444;">[ ■ ■ ■ ]</span>`;
        document.getElementById('quiz-pos').innerText = "CLASSIFIED";
    } else {
        document.getElementById('quiz-word').innerHTML = currentQuizWord.w.toUpperCase();
        document.getElementById('quiz-pos').innerText = currentQuizWord.p;
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
        // CORRECT (Kill Confirm)
        Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');
        playHitMarker(); 
        buttonElement.classList.add('correct');
        
        // Calculate XP
        let wordBaseXp = 100;
        let speedBonus = Math.floor((timeLeft / MAX_TIME) * 50); // Up to +50 based on speed
        let totalGain = wordBaseXp + speedBonus;
        if (isBlindAudio) totalGain *= 2; // Multiplier
        if (attemptsLeft === 1) totalGain = Math.floor(totalGain / 2); // 50% penalty if they missed once
        
        xpScore += totalGain;
        updateXPDisplay();

        if (isBlindAudio) {
            document.getElementById('quiz-word').innerHTML = `<span style="color: #8bc34a;">${currentQuizWord.w.toUpperCase()}</span>`;
            fitText('quiz-word', 4.0);
        }
        
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) passGauntlet();
            else generateQuizQuestion();
        }, 400);

    } else {
        // WRONG (Taking Damage)
        attemptsLeft--;
        playDamageThud();
        triggerDamageFlash();
        buttonElement.classList.add('wrong');
        buttonElement.style.pointerEvents = 'none'; // Disable just this button
        
        xpScore -= 50; // XP Penalty
        if(xpScore < 0) xpScore = 0;
        updateXPDisplay();

        if (attemptsLeft <= 0) {
            Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');
            setTimeout(() => { failGauntlet("ARMOR COMPROMISED"); }, 400);
        }
    }
}

function passGauntlet() {
    clearInterval(gauntletTimer);
    document.getElementById('quiz-container').style.display = 'none';
    
    wordsCleared += 10; 
    currentIndex = wordsCleared; 
    
    localStorage.setItem('tac_cleared', wordsCleared);
    localStorage.setItem('tac_xp', xpScore);
    
    if (wordsCleared >= db.length) {
        showModal("OPERATION COMPLETE", "ALL INTEL SECURED.", "RESTART", () => {
            wordsCleared = 0; currentIndex = 0; xpScore = 0;
            localStorage.setItem('tac_cleared', 0); localStorage.setItem('tac_xp', 0); updateUI();
        });
    } else {
        updateUI();
        playAudio(); // Auto-play the first word of the next batch!
    }
}

function failGauntlet(reason) {
    clearInterval(gauntletTimer);
    showModal("KIA", reason + "\nFALLING BACK TO CHECKPOINT.", "REDEPLOY", () => {
        document.getElementById('quiz-container').style.display = 'none';
        
        currentIndex = wordsCleared; // Reset to start of un-cleared batch
        localStorage.setItem('tac_xp', xpScore); // Save the XP penalties they took!
        
        updateUI();
        playAudio();
    });
}

initApp();
