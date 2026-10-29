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
        
        let storedOrder = localStorage.getItem('cloze_order');
        if (storedOrder) {
            shuffledIndices = JSON.parse(storedOrder);
            if(shuffledIndices.length !== db.length) {
                shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
                localStorage.setItem('cloze_order', JSON.stringify(shuffledIndices));
            }
        } else {
            shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
            localStorage.setItem('cloze_order', JSON.stringify(shuffledIndices));
        }

        if (localStorage.getItem('cloze_cleared')) wordsCleared = parseInt(localStorage.getItem('cloze_cleared'));
        if (localStorage.getItem('cloze_xp')) xpScore = parseInt(localStorage.getItem('cloze_xp'));
        
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
function playDamageSound() { playSynthBeep(150, 'sawtooth', 0.2, 0.3); }

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
    document.getElementById('xp-box').innerText = xpScore.toLocaleString();
}

function updateUI() {
    if (db.length === 0 || currentIndex >= db.length) return;
    const currentWord = db[shuffledIndices[currentIndex]];
    
    document.getElementById('word').innerText = currentWord.w;
    document.getElementById('pos-badge').innerText = currentWord.p;
    document.getElementById('ipa').innerText = currentWord.i;
    document.getElementById('definition').innerText = currentWord.d;
    document.getElementById('sentence').innerText = `"${currentWord.s}"`;
    
    updateXPDisplay();
    fitText('word', 4.0);
    
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

// --- THE CONTEXT INJECTOR (Cloze Quiz) ---
let gauntletTimer;
let gauntletEndTime;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};
let attemptsLeft = 2; 

function triggerDamageFlash() {
    const overlay = document.getElementById('damage-overlay');
    overlay.classList.add('taking-damage');
    setTimeout(() => overlay.classList.remove('taking-damage'), 150);
}

// FLOATING XP PARTICLE EFFECT
function spawnXPPop(amount, btnElement) {
    const rect = btnElement.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'xp-pop';
    popup.innerText = `+${amount} XP`;
    popup.style.left = (rect.left + rect.width / 2) + 'px';
    popup.style.top = rect.top + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1000); 
}

function startGauntlet() {
    document.getElementById('quiz-container').style.display = 'flex';
    playSynthBeep(400, 'square', 0.2); 

    const batchIndices = shuffledIndices.slice(wordsCleared, wordsCleared + 10);
    quizBatchQueue = batchIndices.map(i => db[i]).sort(() => Math.random() - 0.5);

    document.getElementById('timer-text').innerText = "INJECTING...";
    document.getElementById('quiz-sentence').innerHTML = "";
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

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    attemptsLeft = 2; 

    // THE CLOZE INJECTOR
    // Finds the exact target word (case insensitive, whole word boundaries) and replaces it with a blank
    const regex = new RegExp(`\\b${currentQuizWord.w}\\b`, 'gi');
    const clozeSentence = currentQuizWord.s.replace(regex, `<span id="cloze-blank" class="blank-space">[ _______ ]</span>`);
    
    document.getElementById('quiz-sentence').innerHTML = `"${clozeSentence}"`;
    
    // Generate Options (4 random English Words)
    let options = [currentQuizWord.w];
    let attempts = 0; 
    while(options.length < 4 && attempts < 1000) {
        attempts++;
        let randomWrong = db[Math.floor(Math.random() * db.length)].w;
        if(!options.includes(randomWrong)) options.push(randomWrong);
    }
    
    options.sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';
    
    options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = `quiz-option opt-${index}`; 
        btn.innerText = opt;
        btn.onclick = (e) => checkAnswer(opt, e.currentTarget);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedWord, buttonElement) {
    let timeLeft = (gauntletEndTime - Date.now()) / 1000;
    if(timeLeft < 0) timeLeft = 0;

    if (selectedWord === currentQuizWord.w) {
        // CORRECT
        Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');
        playHitSound(); 
        buttonElement.classList.add('correct');
        
        // SNAP THE WORD INTO THE BLANK
        const blank = document.getElementById('cloze-blank');
        if(blank) {
            blank.innerText = currentQuizWord.w.toUpperCase();
            blank.classList.add('filled');
        }
        
        // Calculate XP
        let wordBaseXp = 100;
        let speedBonus = Math.floor((timeLeft / MAX_TIME) * 50); 
        let totalGain = wordBaseXp + speedBonus;
        if (attemptsLeft === 1) totalGain = Math.floor(totalGain / 2); 
        
        xpScore += totalGain;
        updateXPDisplay();
        
        // Spawn Floating Visual
        spawnXPPop(totalGain, buttonElement);
        
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) passGauntlet();
            else generateQuizQuestion();
        }, 600);

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
            setTimeout(() => { failGauntlet("SYSTEM FAILURE"); }, 400);
        }
    }
}

function passGauntlet() {
    clearInterval(gauntletTimer);
    document.getElementById('quiz-container').style.display = 'none';
    
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#66fcf1', '#ff007f', '#ffffff'] });

    wordsCleared += 10; 
    currentIndex = wordsCleared; 
    
    localStorage.setItem('cloze_cleared', wordsCleared);
    localStorage.setItem('cloze_xp', xpScore);
    
    if (wordsCleared >= db.length) {
        showModal("GAME CLEARED", "ALL MODULES MASTERED.", "RESTART", () => {
            wordsCleared = 0; currentIndex = 0; xpScore = 0;
            localStorage.setItem('cloze_cleared', 0); localStorage.setItem('cloze_xp', 0); updateUI();
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
        localStorage.setItem('cloze_xp', xpScore); 
        
        updateUI();
        playAudio();
    });
}

initApp();
