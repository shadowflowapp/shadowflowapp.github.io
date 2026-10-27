let db = []; 
let currentIndex = 0;
let score = 0;

// --- SPEECH SYNTHESIS SETUP (Strictly American English) ---
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    // Prioritize Google's US Male voice, fallback to any US voice
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google')));
    if(!americanMaleVoice) americanMaleVoice = voices.find(v => v.lang === 'en-US');
};

// --- INITIALIZATION ---
async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        // Parse JSONL to array of objects
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR LOADING DATABASE!";
        console.error("Failed to load db.jsonl:", error);
    }
}

// --- SOUND EFFECTS ENGINE ---
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
    
    // Stop any currently playing audio so it doesn't overlap in rapid-fire mode
    synth.cancel(); 
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

// --- UI NAVIGATION ---
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
        // Trigger Gauntlet if they just finished a batch of 10 new words
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

// --- THE GAUNTLET QUIZ ENGINE ---
let gauntletTimer;
let timeLeft;
const MAX_TIME = 30.0;
let currentQuestionIndex = 0;
let quizBatchQueue = [];
let currentQuizWord = {};

function startGauntlet() {
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('danger-pulse');
    playBeep(200, 'sawtooth', 0.5); // Intense start sound

    // Extract exactly the 10 words they just learned and shuffle them
    const batchWords = db.slice(currentIndex - 9, currentIndex + 1);
    quizBatchQueue = batchWords.sort(() => Math.random() - 0.5);

    timeLeft = MAX_TIME;
    currentQuestionIndex = 0;
    generateQuizQuestion();
    
    gauntletTimer = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer-text').innerText = Math.max(0, timeLeft).toFixed(1);
        
        // Heartbeat tempo increases when time is under 5 seconds
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
    let attempts = 0; // Failsafe circuit breaker
    
    // Pick 3 wrong answers that are entirely unique
    while(options.length < 4 && attempts < 1000) {
        attempts++;
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
        
        let isExactMatch = options.includes(randomWrong);
        
        // Prevent similar meaning trickery (e.g. "สามารถ" vs "ความสามารถ")
        let isTooSimilar = options.some(opt => 
            opt.includes(randomWrong) || randomWrong.includes(opt)
        );
        
        if(!isExactMatch && !isTooSimilar) {
            options.push(randomWrong);
        }
    }
    
    // Failsafe: If DB is tiny and loop maxes out, force push padded random words
    while (options.length < 4) {
        options.push(db[Math.floor(Math.random() * db.length)].t + " ");
    }
    
    // Shuffle the 4 options
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
    // Disable all buttons immediately to prevent double-click glitches
    Array.from(document.getElementsByClassName('quiz-option')).forEach(b => b.style.pointerEvents = 'none');

    if (selectedThai === currentQuizWord.t) {
        playBeep(1200, 'sine', 0.1); // Success ding
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
        playBeep(150, 'sawtooth', 0.4); // Failure buzz
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
    
    // Win confetti!
    confetti({ 
        particleCount: 300, 
        spread: 120, 
        origin: { y: 0.5 }, 
        colors: ['#ffe600', '#00e5ff', '#00ff00'] 
    });

    currentIndex++;
    if (currentIndex > score) score = currentIndex;
    updateUI();
    playAudio();
}

function failGauntlet() {
    clearInterval(gauntletTimer);
    
    // Trigger the Custom Modal Penalty
    showModal("FAIL! 💀", "You did not clear the batch. Back to the start!", "TRY AGAIN", () => {
        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('app-container').classList.remove('danger-pulse');
        
        // Punishment: push them 9 words back to repeat the batch
        currentIndex = currentIndex - 9;
        score = currentIndex; 
        updateUI();
        playAudio();
    });
}

// Boot the app
initApp();
