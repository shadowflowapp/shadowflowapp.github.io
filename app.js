let db = []; 
let shuffledIndices = [];
let currentIndex = 0; 
let score = 0; // Represents fully CLEARED words via Quiz

const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google'))) || voices.find(v => v.lang === 'en-US');
};

// --- JS AUTO-SCALER (Fixes Long Words Cutting Off) ---
function fitText(elementId, maxRem) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let currentRem = maxRem;
    el.style.fontSize = currentRem + 'rem';
    
    // While the text overflows its container, shrink the font size
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
        
        // Handle Shuffling
        let storedOrder = localStorage.getItem('mrbeast_order');
        if (storedOrder) {
            shuffledIndices = JSON.parse(storedOrder);
            if(shuffledIndices.length !== db.length) {
                shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
                localStorage.setItem('mrbeast_order', JSON.stringify(shuffledIndices));
            }
        } else {
            shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
            localStorage.setItem('mrbeast_order', JSON.stringify(shuffledIndices));
        }

        // SAVE FILE MIGRATION BUG FIX
        // If users have an old score that isn't a multiple of 10, it breaks the Gauntlet math. This forces it to align.
        if (localStorage.getItem('mrbeast_score_v2')) {
            score = parseInt(localStorage.getItem('mrbeast_score_v2'));
        } else if (localStorage.getItem('mrbeast_score')) {
            let legacyScore = parseInt(localStorage.getItem('mrbeast_score'));
            score = Math.floor(legacyScore / 10) * 10; 
            localStorage.setItem('mrbeast_score_v2', score);
        }
        
        currentIndex = score; 
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR LOADING DATABASE!";
    }
}

// --- SWIPE & KEYBOARD CONTROLS (Anti-Cheat added) ---
let touchstartX = 0;
let touchendX = 0;
document.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    handleGesture();
}, {passive: true});
document.addEventListener('keydown', e => {
    // PREVENT CHEATING OR GLITCHES IN GAUNTLET/MODALS
    if (document.getElementById('quiz-container').style.display === 'flex') return;
    if (document.getElementById('custom-modal').classList.contains('show')) return;
    
    if (e.key === 'ArrowRight') nextWord();
    if (e.key === 'ArrowLeft') prevWord();
});

function handleGesture() {
    if (document.getElementById('quiz-container').style.display === 'flex') return;
    if (document.getElementById('custom-modal').classList.contains('show')) return;
    if (touchendX < touchstartX - 50) nextWord(); // Swipe Left -> Next
    if (touchendX > touchstartX + 50) prevWord(); // Swipe Right -> Prev
}

// --- SOUNDS ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(freq, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}
function playCorrectSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let now = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.50, now); osc.frequency.setValueAtTime(1318.51, now + 0.1);    
    gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.3);
}
function playAudio(word = null) {
    if (db.length === 0) return;
    const textToSpeak = word || db[shuffledIndices[currentIndex]].w;
    synth.cancel(); 
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; synth.speak(utterance);
}

// --- UI UPDATES ---
function updateUI() {
    if (db.length === 0 || currentIndex >= db.length) return;
    const currentWord = db[shuffledIndices[currentIndex]];
    
    document.getElementById('word').innerText = currentWord.w.toUpperCase();
    document.getElementById('ipa').innerText = currentWord.i || "";
    document.getElementById('pos').innerText = currentWord.p;
    document.getElementById('thai').innerText = currentWord.t;
    document.getElementById('score').innerText = score;
    
    // Auto-scale the fonts based on word length!
    fitText('word', 4.5);
    fitText('thai', 3.5);
    
    let batchPos = (currentIndex % 10) + 1;
    document.getElementById('batch-progress').innerText = `${batchPos} / 10`;
    document.getElementById('global-progress-fill').style.width = `${(score / db.length) * 100}%`;

    const nextBtn = document.getElementById('next-btn');
    if (batchPos === 10) {
        nextBtn.innerText = "ENTER GAUNTLET ⚔️";
        nextBtn.classList.add('quiz-ready');
    } else {
        nextBtn.innerText = "NEXT";
        nextBtn.classList.remove('quiz-ready');
    }
}

function prevWord() {
    if (currentIndex > score) {
        currentIndex--;
        updateUI();
    }
}

function nextWord() {
    if (currentIndex < db.length) {
        if ((currentIndex + 1) % 10 === 0 && currentIndex - score === 9) {
            startGauntlet();
            return;
        }
        currentIndex++;
        updateUI();
        playAudio();
    }
}

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

// --- THE GAUNTLET QUIZ ENGINE ---
let gauntletTimer;
let gauntletEndTime;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};
let isBlindAudio = false;

function startGauntlet() {
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('danger-pulse');
    playBeep(200, 'sawtooth', 0.6);

    const batchIndices = shuffledIndices.slice(score, score + 10);
    quizBatchQueue = batchIndices.map(i => db[i]).sort(() => Math.random() - 0.5);

    document.getElementById('timer-text').innerText = "READY!";
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
            if(timeLeft < 5.0 && timeLeft > 0 && Math.floor(timeLeft * 10) % 10 === 0) playBeep(800, 'square', 0.05);

            if (timeLeft <= 0) failGauntlet();
        }, 100);
    }, 600);
}

function playQuizAudio() {
    playAudio(currentQuizWord.w);
}

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    
    isBlindAudio = Math.random() < 0.3;

    if (isBlindAudio) {
        document.getElementById('quiz-word').innerHTML = `<span style="color: #ff007f; animation: pulse 1s infinite alternate;">🔊 BLIND AUDIO</span>`;
        document.getElementById('quiz-pos').innerText = "LISTEN CAREFULLY";
    } else {
        document.getElementById('quiz-word').innerHTML = currentQuizWord.w.toUpperCase();
        document.getElementById('quiz-pos').innerText = currentQuizWord.p;
        // Auto-scale the quiz word
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
    Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');

    if (selectedThai === currentQuizWord.t) {
        playCorrectSound(); 
        buttonElement.classList.add('correct');
        
        if (isBlindAudio) {
            document.getElementById('quiz-word').innerHTML = `<span style="color: #00ff00;">${currentQuizWord.w.toUpperCase()}</span>`;
            fitText('quiz-word', 4.0);
        }
        
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) passGauntlet();
            else generateQuizQuestion();
        }, 400);
    } else {
        playBeep(150, 'sawtooth', 0.4); 
        buttonElement.classList.add('wrong');
        setTimeout(() => { failGauntlet(); }, 400);
    }
}

function passGauntlet() {
    clearInterval(gauntletTimer);
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('app-container').classList.remove('danger-pulse');
    
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#ffe600', '#00e5ff', '#00ff00'] });

    score += 10; 
    currentIndex = score; 
    localStorage.setItem('mrbeast_score_v2', score);
    
    if (score >= db.length) {
        showModal("🏆 FINISHER! 🏆", "YOU CONQUERED THE DICTIONARY!", "RESTART", () => {
            score = 0; currentIndex = 0; localStorage.setItem('mrbeast_score_v2', 0); updateUI();
        });
    } else {
        updateUI();
        playAudio();
    }
}

function failGauntlet() {
    clearInterval(gauntletTimer);
    showModal("FAIL! 💀", "You did not clear the batch. Back to the start!", "TRY AGAIN", () => {
        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('app-container').classList.remove('danger-pulse');
        
        currentIndex = score; 
        updateUI();
        playAudio();
    });
}

initApp();
