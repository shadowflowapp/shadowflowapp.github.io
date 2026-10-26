// State Variables
let db = []; 
let wordsByLetter = {}; 
let currentWordIndex = 0;
let batchStartIndex = 0; 
let learnedCountInBatch = 0;
let quizQueue = [];
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

// DOM Elements
const views = {
    start: document.getElementById('start-view'),
    learn: document.getElementById('learning-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view'),
    topbar: document.getElementById('top-bar')
};

document.getElementById('global-progress').textContent = totalWordsLearned;

// Setup Round Progress Bar
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

// A-Z Alphabet UI Setup
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
            // Center the track mathematically based on its container
            const trackHalfWidth = alphabetTrack.clientWidth / 2;
            alphabetTrack.scrollLeft = node.offsetLeft - trackHalfWidth + (node.clientWidth / 2);
        } else if (passed) {
            node.className = 'az-node az-passed font-black cursor-default select-none relative z-20 bg-[#050505] px-1';
        } else {
            node.className = 'az-node az-future font-black cursor-default select-none relative z-20 bg-[#050505] px-1';
        }
    });
}

// Database Initialization (WITH ROBUST ERROR CATCHING)
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
        
        // Show Start Button only when DB is loaded
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
    document.getElementById('en-definition').textContent = currentWord.definition;
    
    document.getElementById('en-word').style.animation = 'none';
    document.getElementById('pos-tag').style.animation = 'none';
    document.getElementById('en-definition').style.animation = 'none';
    document.getElementById('en-word').offsetHeight; 
    document.getElementById('en-word').style.animation = null; 
    document.getElementById('pos-tag').style.animation = null; 
    document.getElementById('en-definition').style.animation = null; 

    fitTextSync('en-word', 'word-bounds', 80);
}

window.nextWord = function() {
    sfxSwoosh();
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        updateProgressBar(10, 'learn'); 
        setTimeout(startQuiz, 400);
    } else {
        renderLearnView();
    }
};

function startQuiz() {
    views.learn.classList.add('hidden');
    views.learn.classList.remove('flex');
    views.quiz.classList.remove('hidden');
    views.quiz.classList.add('flex');
    
    document.getElementById('round-display').textContent = `QUIZ: ROUND ${currentRound}`;
    currentQuizIndex = 0;
    score = 0;
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnimating = false;
    updateProgressBar(currentQuizIndex, 'quiz');
    
    const q = quizQueue[currentQuizIndex];
    
    const styledSentence = q.sentence.replace('___', '<span class="border-b-4 px-8 mx-1 inline-block h-6 align-baseline transition-all" style="border-color: #666;"></span>');
    
    const sentenceEl = document.getElementById('quiz-sentence');
    sentenceEl.innerHTML = styledSentence;
    sentenceEl.classList.remove('shatter', 'text-neon-red');

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = "w-full py-5 px-4 rounded-xl border border-gray-800 bg-[#111] text-xl font-black text-white lowercase text-center active:scale-95 transition-all truncate shadow-lg";
        btn.textContent = option.toLowerCase();
        
        btn.onclick = () => handleAnswer(btn, option.toLowerCase(), q.word.toLowerCase(), q.sentence);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(btnElement, selectedWord, correctWord, fullSentence) {
    if (isAnimating) return;
    isAnimating = true;

    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    const sentenceEl = document.getElementById('quiz-sentence');
    
    let displayWord = correctWord;
    if (/^['"]?___/.test(fullSentence.trim())) {
        displayWord = displayWord.charAt(0).toUpperCase() + displayWord.slice(1);
    }

    if (selectedWord === correctWord) {
        score++;
        btnElement.classList.add('correct-bg');
        btnElement.classList.remove('border-gray-800', 'bg-[#111]');
        
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-yellow border-b-4 border-current px-2 mx-1">${displayWord}</span>`);
        
        sfxSuccess();
        updateProgressBar(currentQuizIndex + 1, 'quiz');

        setTimeout(() => {
            currentQuizIndex++;
            if (currentQuizIndex >= 10) {
                endQuiz();
            } else {
                renderQuizQuestion();
            }
        }, 1200);

    } else {
        sfxFail();
        btnElement.classList.add('wrong-bg', 'shake');
        btnElement.classList.remove('border-gray-800', 'bg-[#111]');
        
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('correct-bg');
                b.classList.remove('border-gray-800', 'bg-[#111]');
            }
        });
        
        let wrongDisplayWord = selectedWord;
        if (/^['"]?___/.test(fullSentence.trim())) {
            wrongDisplayWord = wrongDisplayWord.charAt(0).toUpperCase() + wrongDisplayWord.slice(1);
        }
        
        document.getElementById('mobile-frame').classList.add('shake');
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-red border-b-4 border-current px-2 mx-1">${wrongDisplayWord}</span>`);
        sentenceEl.classList.add('shatter'); 
        
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
            batchStartIndex = currentWordIndex;
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
    
    renderLearnView();
}

window.addEventListener('resize', () => {
    if (!views.learn.classList.contains('hidden')) fitTextSync('en-word', 'word-bounds', 80);
    if (db[currentWordIndex]) updateAZTracker(db[currentWordIndex].letter.toUpperCase());
});

loadDatabase();
