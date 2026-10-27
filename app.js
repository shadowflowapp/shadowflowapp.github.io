let db = []; 
let currentIndex = 0;
let score = 0;

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
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR!";
    }
}

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

function playAudio(word = null) {
    if (db.length === 0) return;
    const textToSpeak = word || db[currentIndex].w;
    
    // Stop any currently playing audio so it doesn't overlap in rapid-fire quiz mode
    synth.cancel(); 
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

function updateUI() {
    if (db.length === 0) return;
    const currentWord = db[currentIndex];
    document.getElementById('word').innerText = currentWord.w.toUpperCase();
    document.getElementById('pronunciation').innerText = currentWord.i || "";
    document.getElementById('pos').innerText = currentWord.p;
    document.getElementById('thai').innerText = currentWord.t;
    document.getElementById('score').innerText = score;
}

function prevWord() {
    if (currentIndex > 0) {
        currentIndex--;
        updateUI();
    }
}

function nextWord() {
    if (currentIndex < db.length - 1) {
        if (score === currentIndex && (currentIndex + 1) % 10 === 0) {
            score++;
            startGauntlet();
            return;
        }
        currentIndex++;
        if (currentIndex > score) score = currentIndex;
        
        updateUI();
        playAudio();
    }
}

// --- CUSTOM MODAL SYSTEM ---
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
    if (modalCallback) {
        modalCallback();
        modalCallback = null;
    }
}

// --- THE GAUNTLET ---
let gauntletTimer;
let timeLeft;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};

function startGauntlet() {
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('danger-pulse');
    playBeep(200, 'sawtooth', 0.5);

    const batchWords = db.slice(currentIndex - 9, currentIndex + 1);
    quizBatchQueue = batchWords.sort(() => Math.random() - 0.5);

    timeLeft = MAX_TIME;
    currentQuestionIndex = 0;
    generateQuizQuestion();
    
    gauntletTimer = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-text').innerText = Math.max(0, timeLeft).toFixed(1);
        
        if(timeLeft < 5.0 && timeLeft > 0) {
            if(Math.floor(timeLeft * 10) % 10 === 0) playBeep(800, 'square', 0.05);
        }

        if (timeLeft <= 0) {
            failGauntlet();
        }
    }, 100);
}

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    document.getElementById('quiz-word').innerText = currentQuizWord.w.toUpperCase();
    
    // Auto-play audio on question load
    playAudio(currentQuizWord.w);
    
    let options = [currentQuizWord.t];
    while(options.length < 4) {
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
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

function checkAnswer(selectedThai, buttonElement) {
    Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');

    if (selectedThai === currentQuizWord.t) {
        playBeep(1200, 'sine', 0.1);
        buttonElement.classList.add('correct');
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) {
                passGauntlet();
            } else {
                generateQuizQuestion();
            }
        }, 300);
    } else {
        playBeep(150, 'sawtooth', 0.4);
        buttonElement.classList.add('wrong');
        setTimeout(() => {
            failGauntlet();
        }, 300);
    }
}

function passGauntlet() {
    clearInterval(gauntletTimer);
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('app-container').classList.remove('danger-pulse');
    
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#ffe600', '#00e5ff', '#00ff00'] });

    currentIndex++;
    if (currentIndex > score) score = currentIndex;
    updateUI();
    playAudio();
}

function failGauntlet() {
    clearInterval(gauntletTimer);
    
    // Trigger the Custom Modal
    showModal("FAIL! 💀", "You did not clear the batch. Back to the start!", "TRY AGAIN", () => {
        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('app-container').classList.remove('danger-pulse');
        
        currentIndex = currentIndex - 9;
        score = currentIndex; 
        updateUI();
        playAudio();
    });
}

initApp();
