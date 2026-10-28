let db = []; 
let currentIndex = 0;
let score = 0;
let currentAmbushWord = null;

// --- SPEECH SETUP ---
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google')));
    if(!americanMaleVoice) americanMaleVoice = voices.find(v => v.lang === 'en-US');
};

async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        document.getElementById('total-words').innerText = db.length;
        if (localStorage.getItem('efl_score')) {
            score = parseInt(localStorage.getItem('efl_score'));
            currentIndex = score;
            if (currentIndex >= db.length) { currentIndex = db.length - 1; score = currentIndex; }
        }
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR!";
    }
}

// --- SOUND ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playCorrectSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let now = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.50, now);          
    osc.frequency.setValueAtTime(1318.51, now + 0.1);    
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
}

function playAudio(text = null) {
    if (db.length === 0) return;
    const textToSpeak = text || db[currentIndex].c; // Default to reading the Chunk
    synth.cancel(); 
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

// --- MAIN UI ---
function updateUI() {
    if (db.length === 0) return;
    document.getElementById('flashcard').style.display = 'flex';
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('ambush-container').style.display = 'none';
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('app-container').className = '';

    const currentData = db[currentIndex];
    document.getElementById('chunk').innerText = currentData.c.toUpperCase();
    document.getElementById('sentence').innerText = `"${currentData.s}"`;
    document.getElementById('thai').innerText = currentData.t;
    document.getElementById('score').innerText = score;
    
    document.getElementById('global-progress-fill').style.width = `${(score / db.length) * 100}%`;
    localStorage.setItem('efl_score', score);
    
    // Auto-play the chunk when revealing a new card
    playAudio(currentData.c);
}

function prevWord() {
    if (currentIndex > 0) { currentIndex--; updateUI(); }
}

function nextWord() {
    if (currentIndex < db.length - 1) {
        
        // Gauntlet Check (Every 10 words)
        if (score === currentIndex && (currentIndex + 1) % 10 === 0) {
            score++; 
            startGauntlet();
            return;
        }
        
        currentIndex++;
        if (currentIndex > score) score = currentIndex;

        // 15% Chance for a Blind Audio Ambush (Except on the 1st word or right after a Gauntlet)
        if (Math.random() < 0.15 && currentIndex % 10 !== 0 && currentIndex > 1) {
            startAmbush();
            return;
        }
        
        updateUI();
    }
}

// --- MODAL ---
let modalCallback = null;
function showModal(title, desc, btnText, cb) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    document.querySelector('.modal-btn').innerText = btnText;
    modalCallback = cb;
    document.getElementById('custom-modal').classList.add('show');
}
function closeModal() {
    document.getElementById('custom-modal').classList.remove('show');
    if (modalCallback) { modalCallback(); modalCallback = null; }
}

// ==========================================
// MECHANIC 1: THE BLIND AUDIO AMBUSH
// ==========================================
let ambushTimerId;
let ambushTimeLeft;

function startAmbush() {
    document.getElementById('flashcard').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
    document.getElementById('ambush-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('ambush-siren');
    
    playBeep(400, 'square', 0.8); // Alarm sound

    currentAmbushWord = db[currentIndex];
    
    // Play the FULL SENTENCE audio (The core test)
    setTimeout(() => { playAudio(currentAmbushWord.s); }, 500);

    // Generate 4 Chunk Options
    let options = [currentAmbushWord.c];
    while(options.length < 4) {
        let randomChunk = db[Math.floor(Math.random() * db.length)].c;
        if(!options.includes(randomChunk)) options.push(randomChunk);
    }
    options.sort(() => Math.random() - 0.5);

    const container = document.getElementById('ambush-options');
    container.innerHTML = '';
    options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = `quiz-option opt-${index}`; 
        btn.innerText = opt.toUpperCase();
        btn.onclick = (e) => checkAmbush(opt, e.currentTarget);
        container.appendChild(btn);
    });

    ambushTimeLeft = 7.0;
    document.getElementById('ambush-timer').innerText = "7.0";
    
    ambushTimerId = setInterval(() => {
        ambushTimeLeft -= 0.1;
        document.getElementById('ambush-timer').innerText = Math.max(0, ambushTimeLeft).toFixed(1);
        if(ambushTimeLeft <= 0) failAmbush();
    }, 100);
}

function replayAmbushAudio() {
    if(currentAmbushWord) playAudio(currentAmbushWord.s);
}

function checkAmbush(selected, btn) {
    Array.from(document.getElementById('ambush-options').children).forEach(b => b.style.pointerEvents = 'none');
    clearInterval(ambushTimerId);

    if (selected === currentAmbushWord.c) {
        playCorrectSound();
        btn.classList.add('correct');
        setTimeout(() => { updateUI(); }, 800);
    } else {
        playBeep(150, 'sawtooth', 0.4);
        btn.classList.add('wrong');
        setTimeout(() => { failAmbush(); }, 500);
    }
}

function failAmbush() {
    clearInterval(ambushTimerId);
    showModal("AMBUSH FAILED 💀", "You did not hear the context correctly. Try again!", "RETRY", () => {
        currentIndex--; // Push back 1 word as a small penalty
        if (currentIndex < 0) currentIndex = 0;
        score = currentIndex;
        updateUI();
    });
}

// ==========================================
// MECHANIC 2: THE CONTEXT CLOZE GAUNTLET
// ==========================================
let gauntletTimer;
let timeLeft;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};

function startGauntlet() {
    document.getElementById('flashcard').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('danger-pulse');
    
    playBeep(200, 'sawtooth', 0.6);

    const batchWords = db.slice(currentIndex - 9, currentIndex + 1);
    quizBatchQueue = batchWords.sort(() => Math.random() - 0.5);

    document.getElementById('quiz-timer').innerText = "READY!";
    document.getElementById('quiz-sentence').innerHTML = "";
    document.getElementById('quiz-options').innerHTML = '';
    
    setTimeout(() => {
        timeLeft = MAX_TIME;
        currentQuestionIndex = 0;
        generateQuizQuestion();
        
        gauntletTimer = setInterval(() => {
            timeLeft -= 0.1;
            document.getElementById('quiz-timer').innerText = Math.max(0, timeLeft).toFixed(1);
            if(timeLeft < 5.0 && timeLeft > 0 && Math.floor(timeLeft * 10) % 10 === 0) playBeep(800, 'square', 0.05);
            if (timeLeft <= 0) failGauntlet();
        }, 100);
    }, 600);
}

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    
    // Generate the Cloze test (Replace target word with ______)
    const regex = new RegExp(`\\b${currentQuizWord.w}\\b`, 'gi');
    const clozeSentence = currentQuizWord.s.replace(regex, `<span class="blank-space">________</span>`);
    
    document.getElementById('quiz-sentence').innerHTML = `"${clozeSentence}"`;
    
    // We intentionally DO NOT autoplay audio here so they must read the context!
    
    let options = [currentQuizWord.w];
    let attempts = 0; 
    while(options.length < 4 && attempts < 1000) {
        attempts++;
        let randomWord = db[Math.floor(Math.random() * db.length)].w;
        if(!options.includes(randomWord)) options.push(randomWord);
    }
    
    options.sort(() => Math.random() - 0.5);
    const container = document.getElementById('quiz-options');
    container.innerHTML = '';
    
    options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = `quiz-option opt-${index}`; 
        btn.innerText = opt.toUpperCase();
        btn.onclick = (e) => checkGauntletAnswer(opt, e.currentTarget);
        container.appendChild(btn);
    });
}

function checkGauntletAnswer(selected, btn) {
    Array.from(document.getElementById('quiz-options').children).forEach(b => b.style.pointerEvents = 'none');

    if (selected === currentQuizWord.w) {
        playCorrectSound(); 
        btn.classList.add('correct');
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) passGauntlet();
            else generateQuizQuestion();
        }, 400);
    } else {
        playBeep(150, 'sawtooth', 0.4); 
        btn.classList.add('wrong');
        setTimeout(() => { failGauntlet(); }, 400);
    }
}

function passGauntlet() {
    clearInterval(gauntletTimer);
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#ffe600', '#00e5ff', '#ff007f'] });
    currentIndex++;
    if (currentIndex > score) score = currentIndex;
    updateUI();
}

function failGauntlet() {
    clearInterval(gauntletTimer);
    showModal("BATCH FAILED 💀", "You broke the context chain. Back to the start of the batch!", "TRY AGAIN", () => {
        currentIndex = currentIndex - 9;
        score = currentIndex; 
        updateUI();
    });
}

initApp();
