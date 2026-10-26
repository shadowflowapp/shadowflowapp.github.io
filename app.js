// State Variables
let db = []; 
let wordsByLetter = {}; 
let currentWordIndex = 0;
let batchStartIndex = 0; 
let learnedCountInBatch = 0;

// Quiz Variables
let quizTargets = []; // Shuffled targets
let quizOptions = []; // Shuffled buttons
let currentQuizIndex = 0;
let score = 0;
let isAnimating = false; 
let currentRound = 1;

let totalWordsLearned = localStorage.getItem('totalLearnedBeast') ? parseInt(localStorage.getItem('totalLearnedBeast')) : 0;

// --- WEB AUDIO SYNTHESIZER ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
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

function sfxSwoosh() { playTone(250, 'triangle', 0.1, 0.05); vibrate(10); }
function sfxSuccess() { 
    playTone(600, 'sine', 0.1, 0.1); 
    setTimeout(() => playTone(900, 'sine', 0.2, 0.15), 100); 
    vibrate([40, 40, 40]); 
}
function sfxFail() { 
    playTone(150, 'sawtooth', 0.4, 0.2); 
    vibrate([150, 100, 200, 100, 250]); 
}
function vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

const views = {
    start: document.getElementById('start-view'),
    learn: document.getElementById('learning-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view'),
    topbar: document.getElementById('top-bar')
};

document.getElementById('global-progress').textContent = totalWordsLearned;

const progressBar = document.getElementById('progress-bar');
for(let i=0; i<10; i++) {
    const seg = document.createElement('div');
    seg.className = 'segment seg-empty';
    progressBar.appendChild(seg);
}

function updateProgressBar(completedCount, mode) {
    const segments = progressBar.children;
    for(let i=0; i<10; i++) {
        segments[i].className = 'segment seg-empty'; 
        
        if (mode === 'learn') {
            if (i < completedCount) segments[i].classList.add('seg-learn-filled');
            else if (i === completedCount) segments[i].classList.add('seg-learn-active');
        } else if (mode === 'quiz') {
            if (i < completedCount) segments[i].classList.add('seg-quiz-filled');
            else if (i === completedCount) segments[i].classList.add('seg-quiz-active');
        }
    }
}

const alphabetTrack = document.getElementById('az-track');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
alphabet.forEach(letter => {
    const span = document.createElement('span');
    span.id = `az-node-${letter}`;
    span.textContent = letter;
    span.className = 'az-node az-future font-black cursor-default select-none relative z-20 bg-[#050505] px-1';
    alphabetTrack.appendChild(span);
});

function updateAZTracker(currentLetter) {
    let passed = true;
    alphabet.forEach(l => {
        const node = document.getElementById(`az-node-${l}`);
        if (l === currentLetter) {
            node.className = 'az-node az-current font-black cursor-default select-none relative z-20 bg-[#050505] px-2';
            passed = false;
            const trackHalfWidth = alphabetTrack.clientWidth / 2;
            alphabetTrack.scrollLeft = node.offsetLeft - trackHalfWidth + (node.clientWidth / 2);
        } else if (passed) {
            node.className = 'az-node az-passed font-black cursor-default select-none relative z-20 bg-[#050505] px-1';
        } else {
            node.className = 'az-node az-future font-black cursor-default select-none relative z-20 bg-[#050505] px-1';
        }
    });
}

async function loadDatabase() {
    try {
        const response = await fetch('db.jsonl');
        if (!response.ok) throw new Error(`HTTP error!`);
        
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        currentWordIndex = Math.min(totalWordsLearned, db.length - 1);
        batchStartIndex = Math.floor(currentWordIndex / 10) * 10;
        currentWordIndex = batchStartIndex; 
        currentRound = Math.floor(batchStartIndex / 10) + 1;
        
        document.getElementById('start-btn').classList.remove('hidden');
        document.getElementById('start-btn').classList.add('block');
        
    } catch (error) {
        console.error("Error loading db.jsonl:", error);
        const errorBox = document.getElementById('start-error');
        errorBox.classList.remove('hidden');
        errorBox.innerHTML = `<strong>Failed to load db.jsonl</strong><br>You are likely opening the file directly (file://). To fix this, run a local server using a tool like VS Code Live Server.`;
    }
}

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
    initAudio(); 
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
        alert("GAME OVER. YOU BEAT THE DICTIONARY.");
        return;
    }

    document.getElementById('round-display').textContent = `ROUND ${currentRound}`;
    updateProgressBar(learnedCountInBatch, 'learn');
    
    const currentWord = db[currentWordIndex];
    updateAZTracker(currentWord.letter.toUpperCase());

    document.getElementById('en-word').textContent = currentWord.word.toLowerCase();
    document.getElementById('pos-tag').textContent = currentWord.pos;
    document.getElementById('th-meaning').textContent = currentWord.thai;
    
    // Reset Animations
    document.getElementById('en-word').style.animation = 'none';
    document.getElementById('pos-tag').style.animation = 'none';
    document.getElementById('th-meaning').style.animation = 'none';
    document.getElementById('en-word').offsetHeight; 
    document.getElementById('en-word').style.animation = null; 
    document.getElementById('pos-tag').style.animation = null; 
    document.getElementById('th-meaning').style.animation = null; 

    fitTextSync('en-word', 'word-bounds', 80);
    fitTextSync('th-meaning', 'thai-bounds', 45);
}

window.nextWord = function() {
    sfxSwoosh();
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        updateProgressBar(10, 'learn'); 
        setTimeout(startQuiz, 400);
    } else {
        renderLearnView();
    }
};

// --- ELIMINATION BOARD QUIZ LOGIC ---
function startQuiz() {
    views.learn.classList.add('hidden');
    views.learn.classList.remove('flex');
    views.quiz.classList.remove('hidden');
    views.quiz.classList.add('flex');
    
    document.getElementById('round-display').textContent = `MATCHING: ROUND ${currentRound}`;
    currentQuizIndex = 0;
    score = 0;
    
    // Get the 10 words from this batch
    const currentBatch = db.slice(batchStartIndex, batchStartIndex + 10);
    
    // Shuffle the targets (The Thai meanings that appear at the top)
    quizTargets = [...currentBatch].sort(() => Math.random() - 0.5);
    
    // Shuffle the options (The 10 buttons that stay on the board)
    quizOptions = [...currentBatch].sort(() => Math.random() - 0.5);
    
    setupQuizBoard();
}

function setupQuizBoard() {
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    // Render all 10 buttons once
    quizOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "quiz-btn w-full py-4 px-2 rounded-xl border border-gray-800 bg-[#111] text-sm sm:text-base font-black text-white lowercase text-center active:scale-95 transition-all truncate shadow-lg";
        btn.textContent = opt.word.toLowerCase();
        
        btn.onclick = () => handleAnswer(btn, opt.word.toLowerCase());
        optionsContainer.appendChild(btn);
    });

    renderQuizTarget();
}

function renderQuizTarget() {
    isAnimating = false;
    updateProgressBar(currentQuizIndex, 'quiz');
    
    const targetWordObj = quizTargets[currentQuizIndex];
    const targetEl = document.getElementById('quiz-th-target');
    
    targetEl.textContent = targetWordObj.thai;
    targetEl.classList.remove('shatter', 'text-neon-red', 'text-neon-yellow');
    targetEl.classList.add('text-white');
    
    // Restart animation for the new target
    targetEl.style.animation = 'none';
    targetEl.offsetHeight; 
    targetEl.style.animation = null; 

    fitTextSync('quiz-th-target', 'quiz-bounds', 45);
}

function handleAnswer(btnElement, selectedWord) {
    if (isAnimating) return;
    isAnimating = true;

    const correctWord = quizTargets[currentQuizIndex].word.toLowerCase();
    const targetEl = document.getElementById('quiz-th-target');

    if (selectedWord === correctWord) {
        // Success
        score++;
        sfxSuccess();
        
        // Eliminate the button from the board
        btnElement.classList.add('eliminated');
        btnElement.classList.remove('border-gray-800', 'bg-[#111]');
        
        // Target flashes yellow
        targetEl.classList.remove('text-white');
        targetEl.classList.add('text-neon-yellow');
        
        updateProgressBar(currentQuizIndex + 1, 'quiz');

        setTimeout(() => {
            currentQuizIndex++;
            if (currentQuizIndex >= 10) {
                endQuiz();
            } else {
                renderQuizTarget(); // Load next target without re-rendering buttons
            }
        }, 600);

    } else {
        // Fail - NO MERCY
        sfxFail();
        btnElement.classList.add('wrong-bg', 'shake');
        
        // Highlight the correct button they missed
        const allBtns = document.getElementById('quiz-options').querySelectorAll('.quiz-btn');
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('correct-bg');
            }
            b.disabled = true; // Lock the board
        });
        
        document.getElementById('mobile-frame').classList.add('shake');
        targetEl.classList.remove('text-white');
        targetEl.classList.add('shatter', 'text-neon-red'); 
        
        setTimeout(() => {
            document.getElementById('mobile-frame').classList.remove('shake');
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
        title.textContent = "CLEARED!";
        title.className = "text-5xl font-black uppercase mb-2 leading-none text-neon-yellow zoom-in";
        subtitle.textContent = `ROUND ${currentRound} COMPLETE`;
        scoreText.className = "text-[7rem] font-black leading-none mb-auto mt-10 text-neon-yellow drop-shadow-xl";
        
        btn.textContent = "NEXT ROUND";
        btn.className = "w-full mt-auto mb-10 py-6 bg-neon-cyan text-black rounded-2xl text-2xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_20px_rgba(0,229,255,0.4)]";
        
        btn.onclick = () => {
            sfxSwoosh();
            totalWordsLearned += 10;
            localStorage.setItem('totalLearnedBeast', totalWordsLearned);
            document.getElementById('global-progress').textContent = totalWordsLearned;
            batchStartIndex = currentWordIndex; // Already incremented during learning phase
            currentRound++;
            resetForNextRound();
        };
    } else {
        title.textContent = "FAILED";
        title.className = "text-5xl font-black uppercase mb-2 leading-none text-neon-red shake";
        subtitle.textContent = "1 MISTAKE = RESTART";
        scoreText.className = "text-[7rem] font-black leading-none mb-auto mt-10 text-neon-red drop-shadow-xl";
        
        btn.textContent = "RETRY ROUND";
        btn.className = "w-full mt-auto mb-10 py-6 bg-red-600 text-white rounded-2xl text-2xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_15px_rgba(255,0,60,0.8)]";
        
        btn.onclick = () => {
            sfxSwoosh();
            currentWordIndex = batchStartIndex; // Reset to start of the round
            resetForNextRound();
        };
    }
}

function resetForNextRound() {
    learnedCountInBatch = 0;
    
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
        fitTextSync('en-word', 'word-bounds', 80);
        fitTextSync('th-meaning', 'thai-bounds', 45);
    } else if (!views.quiz.classList.contains('hidden')) {
        fitTextSync('quiz-th-target', 'quiz-bounds', 45);
    }
    if (db[currentWordIndex]) updateAZTracker(db[currentWordIndex].letter.toUpperCase());
});

loadDatabase();
