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

let totalWordsLearned = localStorage.getItem('totalLearnedBeast') ? parseInt(localStorage.getItem('totalLearnedBeast')) : 0;

// --- AAA AUDIO SYNTHESIZER ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, type, duration, vol = 0.1, slide = false) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if(slide) {
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function sfxSwoosh() { playTone(150, 'sine', 0.2, 0.05); vibrate(15); }
function sfxSuccess() { 
    playTone(400, 'sine', 0.1, 0.1, true); 
    setTimeout(() => playTone(800, 'sine', 0.3, 0.15), 100); 
    vibrate([30, 30, 40]); 
}
function sfxFail() { 
    playTone(100, 'sawtooth', 0.4, 0.2); 
    vibrate([200, 100, 200, 100, 300]); 
}

function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
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

// Setup Learning Nodes
const learnProgressContainer = document.getElementById('learn-progress');
for(let i=0; i<10; i++) {
    const node = document.createElement('div');
    node.className = 'flex-1 rounded-full node node-empty';
    learnProgressContainer.appendChild(node);
}

// AAA Progress Logic
function syncLearnProgress(currentIndex) {
    const nodes = learnProgressContainer.children;
    for(let i=0; i<10; i++) {
        nodes[i].className = 'flex-1 rounded-full node'; 
        if (i < currentIndex) {
            nodes[i].classList.add('node-completed'); // Locked in
        } else if (i === currentIndex) {
            nodes[i].classList.add('node-current'); // Pulsing, currently learning
        } else {
            nodes[i].classList.add('node-empty'); // Not reached yet
        }
    }
}

function syncQuizXP(currentScore) {
    const fillEl = document.getElementById('xp-fill');
    // Calculate percentage (0 to 10)
    const percentage = (currentScore / 10) * 100;
    fillEl.style.width = `${percentage}%`;
}

// A-Z Alphabet UI Setup
const alphabetTrack = document.getElementById('alphabet-track');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
alphabet.forEach(letter => {
    const span = document.createElement('span');
    span.id = `letter-track-${letter}`;
    span.textContent = letter;
    span.className = 'transition-colors duration-300';
    alphabetTrack.appendChild(span);
});

function updateAZTracker(currentLetter, letterProgress, letterTotal) {
    const targetSpan = document.getElementById(`letter-track-${currentLetter}`);
    if(targetSpan) {
        alphabet.forEach(l => document.getElementById(`letter-track-${l}`).className = 'transition-colors duration-300 text-zinc-700');
        targetSpan.className = 'transition-colors duration-300 text-white text-2xl scale-110 drop-shadow-md';
        targetSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    document.getElementById('current-letter-display').textContent = currentLetter;
    document.getElementById('letter-progress-count').textContent = letterProgress;
    document.getElementById('letter-total-count').textContent = letterTotal;
}

// Database Initialization
async function loadDatabase() {
    try {
        const response = await fetch('db.jsonl');
        if (!response.ok) throw new Error(`HTTP error!`);
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        db.forEach(item => {
            const l = item.letter.toUpperCase();
            if(!wordsByLetter[l]) wordsByLetter[l] = 0;
            wordsByLetter[l]++;
        });
    } catch (error) {
        console.error("Error loading db.jsonl:", error);
    }
}

// Adaptive text sizer calculating against the Mobile Wrapper
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
    
    // Setup Topbar visibility
    document.getElementById('learn-progress').style.opacity = '1';
    document.getElementById('quiz-progress').style.opacity = '0';

    renderLearnView();
};

function renderLearnView() {
    if (currentWordIndex >= db.length) {
        alert("CHALLENGE COMPLETE. YOU MASTERED ALL WORDS.");
        return;
    }

    // Sync nodes precisely to the word index in the 10-batch
    syncLearnProgress(learnedCountInBatch);
    
    const currentWord = db[currentWordIndex];
    const currentLetter = currentWord.letter.toUpperCase();
    const wordsInThisLetterSoFar = db.slice(0, currentWordIndex).filter(w => w.letter.toUpperCase() === currentLetter).length;
    updateAZTracker(currentLetter, wordsInThisLetterSoFar, wordsByLetter[currentLetter]);

    document.getElementById('en-word').textContent = currentWord.word.toLowerCase();
    document.getElementById('pos-tag').textContent = currentWord.pos;
    document.getElementById('en-definition').textContent = currentWord.definition;
    
    // Reset CSS Animations
    document.getElementById('en-word').style.animation = 'none';
    document.getElementById('en-definition').style.animation = 'none';
    document.getElementById('en-word').offsetHeight; 
    document.getElementById('en-word').style.animation = null; 
    document.getElementById('en-definition').style.animation = null; 

    fitTextSync('en-word', 'word-bounds', 80); // Adjusted max size for mobile bounds
}

window.nextWord = function() {
    sfxSwoosh();
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        syncLearnProgress(10); // Lock all 10 white briefly
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
    
    // Swap Topbar UI
    document.getElementById('learn-progress').style.opacity = '0';
    document.getElementById('quiz-progress').style.opacity = '1';
    
    currentQuizIndex = 0;
    score = 0;
    syncQuizXP(score); // Reset bar to 0

    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnimating = false;
    
    const q = quizQueue[currentQuizIndex];
    const styledSentence = q.sentence.replace('___', '<span class="border-b-2 px-6 mx-1 inline-block h-6 sm:h-8 align-baseline" style="border-color: #666;"></span>');
    
    const sentenceEl = document.getElementById('quiz-sentence');
    sentenceEl.innerHTML = styledSentence;
    sentenceEl.classList.remove('shatter', 'text-neon-red');

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = "w-full py-5 px-4 rounded-xl text-xl sm:text-2xl font-black text-zinc-300 lowercase text-center game-btn transition-all truncate tracking-wide";
        btn.textContent = option.toLowerCase();
        
        btn.onclick = () => handleAnswer(btn, option.toLowerCase(), q.word.toLowerCase(), q.sentence);
        optionsContainer.appendChild(btn);
    });
}

// AAA Floating Text Effect
function spawnFloatText(text, isPositive) {
    const fxContainer = document.getElementById('fx-container');
    const span = document.createElement('span');
    span.textContent = text;
    span.className = `font-black text-3xl sm:text-5xl float-up drop-shadow-2xl ${isPositive ? 'text-neon-yellow' : 'text-neon-red'}`;
    fxContainer.appendChild(span);
    setTimeout(() => fxContainer.removeChild(span), 800);
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
        // Success
        score++;
        btnElement.classList.add('game-btn-active');
        
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-yellow border-b-4 border-current px-2 mx-1 drop-shadow-[0_0_10px_#ccff00]">${displayWord}</span>`);
        
        sfxSuccess();
        spawnFloatText('+100 XP', true);
        syncQuizXP(score);

        setTimeout(() => {
            currentQuizIndex++;
            if (currentQuizIndex >= 10) {
                endQuiz();
            } else {
                renderQuizQuestion();
            }
        }, 1200);

    } else {
        // Fail
        sfxFail();
        btnElement.classList.add('game-btn-wrong', 'shake');
        
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('game-btn-active');
            }
        });
        
        let wrongDisplayWord = selectedWord;
        if (/^['"]?___/.test(fullSentence.trim())) {
            wrongDisplayWord = wrongDisplayWord.charAt(0).toUpperCase() + wrongDisplayWord.slice(1);
        }
        
        document.body.classList.add('shake');
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-red border-b-4 border-current px-2 mx-1">${wrongDisplayWord}</span>`);
        sentenceEl.classList.add('shatter'); 
        
        syncQuizXP(0); // Drain XP
        spawnFloatText('FAIL', false);
        
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
        title.className = "text-4xl sm:text-6xl font-black uppercase mb-2 leading-none text-neon-yellow zoom-in drop-shadow-xl";
        subtitle.textContent = "BATCH CLEARED";
        scoreText.className = "text-[6rem] sm:text-[8rem] font-black leading-none mb-auto mt-10 text-neon-yellow drop-shadow-[0_0_30px_rgba(204,255,0,0.5)]";
        
        btn.textContent = "NEXT BATCH";
        btn.className = "w-full mt-auto mb-8 py-5 bg-neon-yellow text-black rounded-xl text-2xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_20px_rgba(204,255,0,0.4)]";
        
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
        scoreText.className = "text-[6rem] sm:text-[8rem] font-black leading-none mb-auto mt-10 text-neon-red drop-shadow-[0_0_30px_rgba(255,0,60,0.5)]";
        
        btn.textContent = "RESTART BATCH";
        btn.className = "w-full mt-auto mb-8 py-5 bg-red-600 text-white rounded-xl text-2xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_20px_rgba(255,0,60,0.6)]";
        
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
    
    // Swap Topbar UI back
    document.getElementById('learn-progress').style.opacity = '1';
    document.getElementById('quiz-progress').style.opacity = '0';
    
    renderLearnView();
}

window.addEventListener('resize', () => {
    if (!views.learn.classList.contains('hidden')) {
        fitTextSync('en-word', 'word-bounds', 80);
    }
});

loadDatabase();
