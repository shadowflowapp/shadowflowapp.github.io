let db = []; 
let currentIndex = 0;
let score = 0;

// --- SPEECH SYNTHESIS SETUP ---
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google')));
    if(!americanMaleVoice) americanMaleVoice = voices.find(v => v.lang === 'en-US');
};

// --- INITIALIZATION & LOAD SAVE DATA ---
async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        document.getElementById('total-words').innerText = db.length;

        // Load progress from browser storage!
        if (localStorage.getItem('mrbeast_score')) {
            score = parseInt(localStorage.getItem('mrbeast_score'));
            currentIndex = score; // Jump straight to where they left off
            
            // Prevent going out of bounds if the database shrank
            if (currentIndex >= db.length) {
                currentIndex = db.length - 1;
                score = currentIndex;
            }
        }
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR LOADING DATABASE!";
    }
}

// --- SOUND EFFECTS ---
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

function playAudio(word = null) {
    if (db.length === 0) return;
    const textToSpeak = word || db[currentIndex].w;
    
    synth.cancel(); 
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

// --- UI & PROGRESS BAR UPDATES ---
function updateUI() {
    if (db.length === 0) return;
    const currentWord = db[currentIndex];
    
    // Update Main Info
    document.getElementById('word').innerText = currentWord.w.toUpperCase();
    document.getElementById('pronunciation').innerText = currentWord.i || "";
    document.getElementById('pos').innerText = currentWord.p;
    document.getElementById('thai').innerText = currentWord.t;
    document.getElementById('score').innerText = score;
    
    // Dynamic Letter Extraction (No DB bloat needed!)
    const letter = currentWord.w.charAt(0).toUpperCase();
    document.getElementById('current-letter').innerText = letter;

    // The Finisher XP Bar
    const progressPercent = (score / db.length) * 100;
    document.getElementById('global-progress-fill').style.width = `${progressPercent}%`;

    // Save Progress!
    localStorage.setItem('mrbeast_score', score);
    
    // THE ULTIMATE FINISHER CHECK
    if (score >= db.length) {
        showModal("🏆 FINISHER! 🏆", "YOU CONQUERED THE ENTIRE DICTIONARY!", "RESTART", () => {
            score = 0;
            currentIndex = 0;
            localStorage.setItem('mrbeast_score', 0);
            updateUI();
        });
    }
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
            score++; // Temporarily increment so they don't get stuck
            startGauntlet();
            return;
        }
        
        currentIndex++;
        if (currentIndex > score) score = currentIndex;
        
        updateUI();
        playAudio();
    }
}

// --- CUSTOM MODAL ---
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
    
    playBeep(200, 'sawtooth', 0.6);

    const batchWords = db.slice(currentIndex - 9, currentIndex + 1);
    quizBatchQueue = batchWords.sort(() => Math.random() - 0.5);

    document.getElementById('timer-text').innerText = "READY!";
    document.getElementById('quiz-word').innerHTML = "";
    document.getElementById('quiz-options').innerHTML = '';
    
    setTimeout(() => {
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
    }, 600);
}

function generateQuizQuestion() {
    currentQuizWord = quizBatchQueue[currentQuestionIndex];
    
    document.getElementById('quiz-word').innerHTML = `
        ${currentQuizWord.w.toUpperCase()} 
        <br>
        <span style="font-size: 1.5rem; color: #ff007f; font-family: 'Nunito', sans-serif; background: #222; padding: 2px 10px; border-radius: 10px; border: 2px solid #000;">
            ${currentQuizWord.p}
        </span>
    `;
    
    playAudio(currentQuizWord.w);
    
    let options = [currentQuizWord.t];
    let attempts = 0; 
    
    while(options.length < 4 && attempts < 1000) {
        attempts++;
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
        
        let isExactMatch = options.includes(randomWrong);
        let isTooSimilar = options.some(opt => opt.includes(randomWrong) || randomWrong.includes(opt));
        
        if(!isExactMatch && !isTooSimilar) {
            options.push(randomWrong);
        }
    }
    
    while (options.length < 4) {
        options.push(db[Math.floor(Math.random() * db.length)].t + " ");
    }
    
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
