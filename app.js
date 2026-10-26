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

function sfxSwoosh() { playTone(200, 'triangle', 0.15, 0.05); vibrate(15); }
function sfxSuccess() { 
    playTone(500, 'sine', 0.1, 0.1); 
    setTimeout(() => playTone(800, 'sine', 0.2, 0.15), 100); 
    vibrate([50, 50, 50]); 
}
function sfxFail() { 
    playTone(150, 'sawtooth', 0.4, 0.2); 
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

// Setup Progress Bar
const progressBar = document.getElementById('progress-bar');
for(let i=0; i<10; i++) {
    const seg = document.createElement('div');
    seg.className = 'flex-1 rounded-full segment segment-empty';
    progressBar.appendChild(seg);
}

// UPDATED PROGRESS BAR LOGIC (Inner Glow & Current Position Pulsing)
function updateProgressBar(count, mode) {
    const segments = progressBar.children;
    for(let i=0; i<10; i++) {
        // Reset every bar to empty baseline
        segments[i].className = 'flex-1 rounded-full segment segment-empty'; 
        
        if (mode === 'learn') {
            if (i < count) {
                segments[i].classList.add('segment-completed-learn'); // Solid white
            } else if (i === count) {
                segments[i].classList.add('segment-current-learn'); // Pulsing Blue
            }
        } else if (mode === 'quiz') {
            if (i < count) {
                segments[i].classList.add('segment-active-quiz'); // Inner Glow Yellow
            } else if (i === count) {
                segments[i].classList.add('segment-current-quiz'); // Pulsing Gray
            }
        }
    }
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
        alphabet.forEach(l => document.getElementById(`letter-track-${l}`).className = 'transition-colors duration-300 text-gray-700');
        targetSpan.className = 'transition-colors duration-300 text-white text-2xl scale-110';
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
    views.start.classList.add('hidden');
    views.topbar.classList.remove('hidden');
    views.topbar.classList.add('flex');
    views.learn.classList.remove('hidden');
    views.learn.classList.add('flex'); 
    
    renderLearnView();
};

function renderLearnView() {
    initAudio(); // Ensures audio unlocks safely on first render
    
    if (currentWordIndex >= db.length) {
        alert("CHALLENGE COMPLETE. YOU MASTERED ALL WORDS.");
        return;
    }

    // Call update progress bar
    updateProgressBar(learnedCountInBatch, 'learn');
    
    const currentWord = db[currentWordIndex];
    
    const currentLetter = currentWord.letter.toUpperCase();
    const wordsInThisLetterSoFar = db.slice(0, currentWordIndex).filter(w => w.letter.toUpperCase() === currentLetter).length;
    updateAZTracker(currentLetter, wordsInThisLetterSoFar, wordsByLetter[currentLetter]);

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

    fitTextSync('en-word', 'word-bounds', 100);
}

window.nextWord = function() {
    sfxSwoosh();
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        // Visually mark the final bar as completed before jumping to quiz
        updateProgressBar(10, 'learn'); 
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
    
    const styledSentence = q.sentence.replace('___', '<span class="border-b-4 px-6 mx-1 inline-block h-6 sm:h-8 align-baseline" style="border-color: #ccff00;"></span>');
    
    const sentenceEl = document.getElementById('quiz-sentence');
    sentenceEl.innerHTML = styledSentence;
    sentenceEl.classList.remove('shatter', 'text-neon-red');

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = "w-full py-6 px-4 rounded-xl border-2 border-gray-800 bg-gray-900 text-2xl sm:text-3xl font-black text-white lowercase text-center active:scale-95 transition-all truncate shadow-lg";
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
        btnElement.classList.remove('border-gray-800');
        
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
        }, 1500);

    } else {
        sfxFail();
        btnElement.classList.add('wrong-bg', 'shake');
        btnElement.classList.remove('border-gray-800');
        
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('correct-bg');
                b.classList.remove('border-gray-800');
            }
        });
        
        let wrongDisplayWord = selectedWord;
        if (/^['"]?___/.test(fullSentence.trim())) {
            wrongDisplayWord = wrongDisplayWord.charAt(0).toUpperCase() + wrongDisplayWord.slice(1);
        }
        
        document.body.classList.add('shake');
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-red border-b-4 border-current px-2 mx-1">${wrongDisplayWord}</span>`);
        sentenceEl.classList.add('shatter'); 
        
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
    }
});

loadDatabase();
