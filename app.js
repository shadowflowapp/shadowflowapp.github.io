let db = []; // Will be populated dynamically
let currentIndex = 0;
let score = 0;

// Speech Setup
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google')));
    if(!americanMaleVoice) americanMaleVoice = voices.find(v => v.lang === 'en-US');
};

// Fetch Database on Load
async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        
        // Parse JSONL (split by line, ignore empty lines, parse to JSON)
        db = text.split('\n')
                 .filter(line => line.trim() !== '')
                 .map(line => JSON.parse(line));
        
        // Hide loading screen and show first word
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        alert("Error loading database. Make sure db.jsonl is in the same folder and you are running a local server.");
        console.error(error);
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
        // Did they just finish learning 10 new words? Trigger Vault Lockdown.
        if (score === currentIndex && (currentIndex + 1) % 10 === 0) {
            score++;
            startLockdown();
            return;
        }

        currentIndex++;
        if (currentIndex > score) score = currentIndex;
        
        updateUI();
        playAudio(); // Auto play audio on new word for fast pacing
    }
}

// --- VAULT LOCKDOWN MECHANIC (Smooth Theme) ---

let lockdownTimer;
let timeLeft;
const MAX_TIME = 10.0;
let questionsToPass = 3;
let currentQuestionIndex = 0;
let currentQuizWord = {};

function startLockdown() {
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('smooth-breathe');
    
    // Smooth alert beep
    let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);

    timeLeft = MAX_TIME;
    currentQuestionIndex = 0;
    generateQuizQuestion();
    
    // Visual Timer update (100 times a second for buttery smooth bar shrinking)
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
    document.getElementById('quiz-progress').innerText = `${currentQuestionIndex + 1}/${questionsToPass}`;
    
    // Get a random word from the last 10 words learned
    const minIndex = currentIndex - 9;
    const randomIndex = Math.floor(Math.random() * 10) + minIndex;
    currentQuizWord = db[randomIndex];

    document.getElementById('quiz-word').innerText = currentQuizWord.w;
    
    // Generate options (1 correct, 3 random wrong answers from entire DB)
    let options = [currentQuizWord.t];
    while(options.length < 4) {
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
        if(!options.includes(randomWrong)) {
            options.push(randomWrong);
        }
    }
    
    // Shuffle options
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
        // Correct - brief flash of green
        buttonElement.classList.add('correct');
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= questionsToPass) {
                passLockdown();
            } else {
                generateQuizQuestion();
            }
        }, 150);
    } else {
        // Wrong - flash red and immediate fail
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
    
    // Success Confetti
    confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#00e5ff', '#ffffff', '#4CAF50']
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
    
    alert("❌ ACCESS DENIED. Vault lock triggered. Review the last 10 words!");
    
    // Punishment: Push them back 9 words
    currentIndex = currentIndex - 9;
    score = currentIndex; 
    updateUI();
    playAudio();
}

// Start app
initApp();
