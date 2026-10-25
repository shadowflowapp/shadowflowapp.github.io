// State Variables
let db = []; 
let currentWordIndex = 0;
let batchStartIndex = 0; 
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

let currentAnswerArray = [];
let currentSpellingIndex = 0;
let isAnimating = false; 

let totalWordsLearned = localStorage.getItem('totalLearnedBeast') ? parseInt(localStorage.getItem('totalLearnedBeast')) : 0;

// --- WEB AUDIO SYNTHESIZER (For zero-dependency sound effects) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration, vol = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Sound Effect Triggers
function sfxTick() { playTone(800, 'sine', 0.1, 0.1); vibrate(10); } // Tap letter
function sfxSwoosh() { playTone(200, 'triangle', 0.15, 0.05); vibrate(15); } // Next word
function sfxSuccess() { 
    playTone(500, 'sine', 0.1, 0.1); 
    setTimeout(() => playTone(800, 'sine', 0.2, 0.15), 100); 
    vibrate([50, 50, 50]); 
}
function sfxFail() { 
    playTone(150, 'sawtooth', 0.4, 0.2); 
    vibrate([200, 100, 200, 100, 300]); 
}

// Haptic Feedback helper
function vibrate(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// DOM Elements
const views = {
    start: document.getElementById('start-view'),
    learn: document.getElementById('learning-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view'),
    topbar: document.getElementById('top-bar')
};

document.getElementById('global-progress').textContent = totalWordsLearned;

// Segmented Progress Bar Setup
const progressBar = document.getElementById('progress-bar');
for(let i=0; i<10; i++) {
    const seg = document.createElement('div');
    seg.className = 'flex-1 rounded-full segment segment-empty';
    progressBar.appendChild(seg);
}

function updateProgressBar(count, mode) {
    const segments = progressBar.children;
    for(let i=0; i<10; i++) {
        segments[i].className = 'flex-1 rounded-full segment segment-empty'; // reset
        if (i < count) {
            if (mode === 'learn') segments[i].classList.add('segment-active-learn');
            if (mode === 'quiz') segments[i].classList.add('segment-active-quiz');
        }
    }
}

async function loadDatabase() {
    try {
        const response = await fetch('db.jsonl');
        if (!response.ok) throw new Error(`HTTP error!`);
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
    } catch (error) {
        console.error("Error loading db.jsonl:", error);
    }
}

// Math Scaling Text
function fitTextSync(textElementId, boundContainerId, maxFontSizePx) {
    const textEl = document.getElementById(textElementId);
    const boundsEl = document.getElementById(boundContainerId);
    
    textEl.style.fontSize = `${maxFontSizePx}px`;
    textEl.style.whiteSpace = 'nowrap';

    const textWidth = textEl.scrollWidth;
    const containerWidth = boundsEl.clientWidth;
    
    if (textWidth > containerWidth && containerWidth > 0) {
        const ratio = containerWidth / textWidth;
        const exactSafeFit = Math.floor(maxFontSizePx * ratio * 0.95);
        textEl.style.fontSize = `${exactSafeFit}px`;
    }
}

window.startChallenge = function() {
    initAudio(); // Initialize audio context on first user interaction
    sfxSwoosh();
    
    views.start.classList.add('hidden');
    views.topbar.classList.remove('hidden');
    views.topbar.classList.add('flex');
    views.learn.classList.remove('hidden');
    views.learn.classList.add('flex'); 
    
    renderLearnView();
};

function renderLearnView() {
    if (currentWordIndex >= db.length) {
        alert("CHALLENGE COMPLETE. YOU MASTERED ALL WORDS.");
        return;
    }

    updateProgressBar(learnedCountInBatch, 'learn');
    const currentWord = db[currentWordIndex];
    
    document.getElementById('en-word').textContent = currentWord.word;
    document.getElementById('pos-tag').textContent = currentWord.pos;
    document.getElementById('th-meaning').textContent = currentWord.thai;
    
    // Restart CSS Animations
    document.getElementById('en-word').style.animation = 'none';
    document.getElementById('pos-tag').style.animation = 'none';
    document.getElementById('th-meaning').style.animation = 'none';
    document.getElementById('en-word').offsetHeight; 
    document.getElementById('en-word').style.animation = null; 
    document.getElementById('pos-tag').style.animation = null; 
    document.getElementById('th-meaning').style.animation = null; 

    fitTextSync('en-word', 'word-bounds', 100);
    fitTextSync('th-meaning', 'thai-bounds', 40);
}

window.nextWord = function() {
    sfxSwoosh();
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        updateProgressBar(10, 'learn'); // fill briefly
        setTimeout(startQuiz, 300);
    } else {
        renderLearnView();
    }
};

function startQuiz() {
    views.learn.classList.add('hidden');
    views.learn.classList.remove('flex');
    views.quiz.classList.remove('hidden');
    views.quiz.classList.add('flex');
    
    currentQuizIndex = 0;
    score = 0;
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnimating = false;
    updateProgressBar(currentQuizIndex, 'quiz');
    
    const q = quizQueue[currentQuizIndex];
    const correctWord = q.word.toUpperCase();
    
    currentSpellingIndex = 0;
    currentAnswerArray = Array(correctWord.length).fill('_');
    
    document.getElementById('quiz-th-target').textContent = q.thai;
    fitTextSync('quiz-th-target', 'quiz-bounds', 35);

    document.getElementById('answer-display').className = "font-black text-white tracking-[0.2em] leading-none whitespace-nowrap drop-shadow-lg";
    updateAnswerDisplay();

    let letters = correctWord.split('');
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    
    const poolContainer = document.getElementById('letter-pool');
    poolContainer.innerHTML = ''; 

    letters.forEach((letter) => {
        const btn = document.createElement('button');
        btn.className = "w-14 h-16 sm:w-16 sm:h-20 rounded-lg border-b-4 border-gray-700 bg-gray-800 text-3xl sm:text-4xl font-black text-white uppercase text-center active:scale-95 active:border-b-0 active:translate-y-1 transition-all flex justify-center items-center shadow-lg";
        btn.textContent = letter;
        btn.onclick = () => handleLetterTap(btn, letter, correctWord);
        poolContainer.appendChild(btn);
    });
}

function updateAnswerDisplay(isError = false) {
    const displayEl = document.getElementById('answer-display');
    displayEl.textContent = currentAnswerArray.join('');
    
    if (isError) {
        displayEl.classList.add('text-neon-red');
        displayEl.classList.remove('text-white');
    }
    fitTextSync('answer-display', 'answer-bounds', 70);
}

function handleLetterTap(btnElement, letter, correctWord) {
    if (isAnimating) return;

    const expectedLetter = correctWord[currentSpellingIndex];

    if (letter === expectedLetter) {
        sfxTick(); // Haptic & Audio
        currentAnswerArray[currentSpellingIndex] = letter;
        currentSpellingIndex++;
        
        btnElement.classList.add('hidden-tile');
        updateAnswerDisplay();

        if (currentSpellingIndex === correctWord.length) {
            isAnimating = true;
            score++;
            sfxSuccess();
            
            document.getElementById('answer-display').classList.add('text-neon-yellow');
            document.getElementById('answer-display').classList.remove('text-white');
            updateProgressBar(currentQuizIndex + 1, 'quiz'); // Fill the bar

            setTimeout(() => {
                currentQuizIndex++;
                if (currentQuizIndex >= 10) {
                    endQuiz();
                } else {
                    renderQuizQuestion();
                }
            }, 700);
        }
    } else {
        isAnimating = true;
        sfxFail(); // Buzz and dissonant tone
        
        currentAnswerArray[currentSpellingIndex] = letter;
        updateAnswerDisplay(true); 
        
        btnElement.classList.add('wrong-bg');
        document.body.classList.add('shake');
        
        // Shatter animation on the answer text
        document.getElementById('answer-display').classList.add('shatter');
        
        setTimeout(() => {
            document.body.classList.remove('shake');
            score = 0; 
            endQuiz();
        }, 1200);
    }
}

function endQuiz() {
    views.topbar.classList.add('hidden');
    views.topbar.classList.remove('flex');
    views.quiz.classList.add('hidden');
    views.quiz.classList.remove('flex');
    views.result.classList.remove('hidden');
    views.result.classList.add('flex');
    
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const scoreText = document.getElementById('final-score');
    const btn = document.getElementById('result-btn');

    scoreText.textContent = `${score}/10`;

    if (score === 10) {
        title.textContent = "YOU CRUSHED IT!";
        title.className = "text-5xl sm:text-7xl font-black uppercase mb-2 leading-none text-neon-yellow zoom-in";
        subtitle.textContent = "BATCH CLEARED";
        scoreText.className = "text-[6rem] sm:text-[9rem] font-black leading-none mb-auto mt-10 text-neon-yellow drop-shadow-xl";
        
        btn.textContent = "NEXT BATCH";
        btn.className = "w-full max-w-md mt-auto mb-10 py-6 bg-neon-blue text-black rounded-xl text-3xl font-black active:scale-95 transition-transform uppercase";
        
        btn.onclick = () => {
            sfxSwoosh();
            totalWordsLearned += 10;
            localStorage.setItem('totalLearnedBeast', totalWordsLearned);
            document.getElementById('global-progress').textContent = totalWordsLearned;
            batchStartIndex = currentWordIndex;
            resetForNextRound();
        };
    } else {
        title.textContent = "FAILED";
        title.className = "text-5xl sm:text-7xl font-black uppercase mb-2 leading-none text-neon-red shake";
        subtitle.textContent = "1 MISTAKE = RESTART";
        scoreText.className = "text-[6rem] sm:text-[9rem] font-black leading-none mb-auto mt-10 text-neon-red drop-shadow-xl";
        
        btn.textContent = "RESTART BATCH";
        btn.className = "w-full max-w-md mt-auto mb-10 py-6 bg-red-600 text-white rounded-xl text-3xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_15px_rgba(255,0,60,0.8)]";
        
        btn.onclick = () => {
            sfxSwoosh();
            currentWordIndex = batchStartIndex;
            resetForNextRound();
        };
    }
}

function resetForNextRound() {
    learnedCountInBatch = 0;
    quizQueue = [];
    
    views.result.classList.add('hidden');
    views.result.classList.remove('flex');
    views.topbar.classList.remove('hidden');
    views.topbar.classList.add('flex');
    views.learn.classList.remove('hidden');
    views.learn.classList.add('flex');
    
    updateProgressBar(0, 'learn');
    renderLearnView();
}

window.addEventListener('resize', () => {
    if (!views.learn.classList.contains('hidden')) {
        fitTextSync('en-word', 'word-bounds', 100);
        fitTextSync('th-meaning', 'thai-bounds', 40);
    } else if (!views.quiz.classList.contains('hidden')) {
        fitTextSync('quiz-th-target', 'quiz-bounds', 35);
        fitTextSync('answer-display', 'answer-bounds', 70);
    }
});

loadDatabase();
