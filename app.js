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
        
        db = text.split('\n')
                 .filter(line => line.trim() !== '')
                 .map(line => JSON.parse(line));
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        alert("Error loading database. Ensure db.jsonl is present and running on a local server.");
    }
}

function playAudio(word = null) {
    if (db.length === 0) return;
    const textToSpeak = word || db[currentIndex].w;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.9; 
    synth.speak(utterance);
}

function updateUI() {
    if (db.length === 0) return;
    const currentWord = db[currentIndex];
    document.getElementById('word').innerText = currentWord.w;
    document.getElementById('ipa').innerText = currentWord.i || "N/A";
    document.getElementById('thai-pronounce').innerText = currentWord.tp || "N/A";
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
            startLockdown();
            return;
        }

        currentIndex++;
        if (currentIndex > score) score = currentIndex;
        
        updateUI();
        playAudio();
    }
}

// --- EXHAUSTIVE BATCH LOCKDOWN ---

let lockdownTimer;
let timeLeft;
const MAX_TIME = 30.0; // 30 seconds to answer all 10 words
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};

function startLockdown() {
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('smooth-breathe');
    
    let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);

    // Extract exact 10 words they just learned and shuffle them
    const batchWords = db.slice(currentIndex - 9, currentIndex + 1);
    quizBatchQueue = batchWords.sort(() => Math.random() - 0.5);

    timeLeft = MAX_TIME;
    currentQuestionIndex = 0;
    generateQuizQuestion();
    
    lockdownTimer = setInterval(() => {
        timeLeft -= 0.05;
        let percentage = (timeLeft / MAX_TIME) * 100;
        document.getElementById('timer-bar').style.width = `${Math.max(0, percentage)}%`;
        
        if (timeLeft <= 0) {
            failLockdown();
        }
    }, 50);
}

function generateQuizQuestion() {
    document.getElementById('quiz-progress').innerText = `${currentQuestionIndex + 1}/10`;
    
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    document.getElementById('quiz-word').innerText = currentQuizWord.w;
    
    let options = [currentQuizWord.t];
    while(options.length < 4) {
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
        if(!options.includes(randomWrong)) {
            options.push(randomWrong);
        }
    }
    
    options.sort(() => Math.random() - 0.5);
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerText = opt;
        btn.onclick = (e) => checkAnswer(opt, e.target);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedThai, buttonElement) {
    if (selectedThai === currentQuizWord.t) {
        buttonElement.classList.add('correct');
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) {
                passLockdown();
            } else {
                generateQuizQuestion();
            }
        }, 150);
    } else {
        buttonElement.classList.add('wrong');
        setTimeout(() => {
            failLockdown();
        }, 150);
    }
}

function passLockdown() {
    clearInterval(lockdownTimer);
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('app-container').classList.remove('smooth-breathe');
    
    confetti({
        particleCount: 200,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#00e5ff', '#ffffff', '#ffcc00']
    });

    currentIndex++;
    if (currentIndex > score) score = currentIndex;
    updateUI();
    playAudio();
}

function failLockdown() {
    clearInterval(lockdownTimer);
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('app-container').classList.remove('smooth-breathe');
    
    alert("❌ BATCH FAILED. You must master all 10 words. Try again!");
    
    currentIndex = currentIndex - 9;
    score = currentIndex; 
    updateUI();
    playAudio();
}

initApp();
