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

// AAA Game SFX
function sfxSwoosh() { playTone(200, 'triangle', 0.1, 0.05); vibrate(10); }
function sfxSuccess() { 
    playTone(600, 'sine', 0.1, 0.1); 
    setTimeout(() => playTone(900, 'sine', 0.15, 0.15), 80); 
    vibrate([40, 40, 40]); 
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
    seg.className = 'flex-1 segment segment-empty';
    progressBar.appendChild(seg);
}

// AAA Synchronous Combo Bar Logic
function updateProgressBar(count, mode) {
    const segments = progressBar.children;
    for(let i=0; i<10; i++) {
        // Reset every bar
        segments[i].className = 'flex-1 segment segment-empty'; 
        
        if (mode === 'learn') {
            if (i < count) {
                segments[i].classList.add('segment-completed-learn'); 
            } else if (i === count) {
                segments[i].classList.add('segment-current-learn'); 
            }
        } else if (mode === 'quiz') {
            if (i < count) {
                segments[i].classList.add('segment-completed-quiz'); 
            } else if (i === count) {
                segments[i].classList.add('segment-current-quiz'); 
            }
        } else if (mode === 'fail') {
            segments[i].classList.add('segment-fail'); 
        }
    }
}

// Load Database
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

function getRoundNumber() {
    return Math.floor(batchStartIndex / 10) + 1;
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
        alert("GAME COMPLETE. YOU BEAT THE DICTIONARY.");
        return;
    }

    // AAA Combo Bar - Sync with current learning step (0 to 9)
    updateProgressBar(learnedCountInBatch, 'learn');
    
    const currentWord = db[currentWordIndex];
    const currentLetter = currentWord.letter.toUpperCase();
    const wordsInThisLetterSoFar = db.slice(0, currentWordIndex).filter(w => w.letter.toUpperCase() === currentLetter).length;
    
    document.getElementById('round-display').textContent = getRoundNumber();
    document.getElementById('current-letter-display').textContent = currentLetter;
    document.getElementById('letter-progress-count').textContent = wordsInThisLetterSoFar;
    document.getElementById('letter-total-count').textContent = wordsByLetter[currentLetter];

    document.getElementById('en-word').textContent = currentWord.word.toLowerCase();
    document.getElementById('pos-tag').textContent = currentWord.pos;
    document.getElementById('en-definition').textContent = currentWord.definition;
    
    // Reset Animations
    document.getElementById('en-word').style.animation = 'none';
    document.getElementById('pos-tag').style.animation = 'none';
    document.getElementById('en-definition').style.animation = 'none';
    document.getElementById('en-word').offsetHeight; 
    document.getElementById('en-word').style.animation = null; 
    document.getElementById('pos-tag').style.animation = null; 
    document.getElementById('en-definition').style.animation = null; 

    fitTextSync('en-word', 'word-bounds', 80); // Adjusted max size for mobile frame
}

window.nextWord = function() {
    sfxSwoosh();
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        // Visually lock in the 10th bar briefly before jumping
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
    
    currentQuizIndex = 0;
    score = 0;
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnimating = false;
    
    // AAA Combo Bar - Sync with current quiz question (0 to 9)
    updateProgressBar(currentQuizIndex, 'quiz');
    
    const q = quizQueue[currentQuizIndex];
    
    // Glowing underline for blank
    const styledSentence = q.sentence.replace('___', '<span class="border-b-2 px-6 mx-1 inline-block h-5 align-baseline" style="border-color: #ccff00; box-shadow: 0 4px 6px -4px #ccff00;"></span>');
    
    const sentenceEl = document.getElementById('quiz-sentence');
    sentenceEl.innerHTML = styledSentence;
    sentenceEl.classList.remove('shatter', 'text-neon-red');

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach((option, idx) => {
        const btn = document.createElement('button');
        // Clean, angled mobile game aesthetic
        btn.className = "w-full py-5 px-4 rounded-lg border border-zinc-800 bg-zinc-900/80 text-xl font-bold text-white lowercase text-center active:scale-95 transition-all truncate";
        // Staggered animation delay
        btn.style.animationDelay = `${0.1 + (idx * 0.05)}s`;
        btn.classList.add('zoom-in');
        
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
        btnElement.classList.remove('border-zinc-800', 'bg-zinc-900/80');
        
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-yellow border-b-2 border-current px-1 mx-1">${displayWord}</span>`);
        
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
        btnElement.classList.remove('border-zinc-800', 'bg-zinc-900/80');
        
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('correct-bg');
                b.classList.remove('border-zinc-800', 'bg-zinc-900/80');
            }
        });
        
        let wrongDisplayWord = selectedWord;
        if (/^['"]?___/.test(fullSentence.trim())) {
            wrongDisplayWord = wrongDisplayWord.charAt(0).toUpperCase() + wrongDisplayWord.slice(1);
        }
        
        // Shatter Effect & Red Combo Bar
        updateProgressBar(0, 'fail');
        document.getElementById('app-frame').classList.add('shake');
        sentenceEl.innerHTML = fullSentence.replace('___', `<span class="text-neon-red border-b-2 border-current px-1 mx-1">${wrongDisplayWord}</span>`);
        sentenceEl.classList.add('shatter'); 
        
        setTimeout(() => {
            document.getElementById('app-frame').classList.remove('shake');
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
    
    // Reset animations
    const els = views.result.querySelectorAll('.zoom-in');
    els.forEach(el => {
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = null;
    });
    
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const scoreText = document.getElementById('final-score');
    const btn = document.getElementById('result-btn');

    scoreText.textContent = `${score}/10`;

    if (score === 10) {
        icon.textContent = "🏆";
        title.textContent = "ROUND CLEARED";
        title.className = "text-4xl font-black uppercase mb-2 leading-none text-neon-yellow zoom-in";
        subtitle.textContent = "PERFECT SCORE";
        scoreText.className = "text-[5rem] font-black leading-none mb-auto mt-4 text-neon-yellow drop-shadow-xl zoom-in";
        
        btn.textContent = `START ROUND ${getRoundNumber() + 1}`;
        btn.className = "w-full mt-auto mb-8 py-5 bg-[#ccff00] text-black rounded-xl text-2xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_20px_rgba(204,255,0,0.4)] zoom-in";
        
        btn.onclick = () => {
            sfxSwoosh();
            totalWordsLearned += 10;
            localStorage.setItem('totalLearnedBeast', totalWordsLearned);
            document.getElementById('global-progress').textContent = totalWordsLearned;
            batchStartIndex = currentWordIndex;
            resetForNextRound();
        };
    } else {
        icon.textContent = "💀";
        title.textContent = "GAME OVER";
        title.className = "text-4xl font-black uppercase mb-2 leading-none text-neon-red zoom-in";
        subtitle.textContent = "1 MISTAKE = RESTART ROUND";
        scoreText.className = "text-[5rem] font-black leading-none mb-auto mt-4 text-neon-red drop-shadow-xl zoom-in";
        
        btn.textContent = `RETRY ROUND ${getRoundNumber()}`;
        btn.className = "w-full mt-auto mb-8 py-5 bg-[#ff003c] text-white rounded-xl text-2xl font-black active:scale-95 transition-transform uppercase shadow-[0_0_20px_rgba(255,0,60,0.5)] zoom-in";
        
        btn.onclick = () => {
            sfxSwoosh();
            currentWordIndex = batchStartIndex; // Resets back to start of round
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
    if (!views.learn.classList.contains('hidden')) {
        fitTextSync('en-word', 'word-bounds', 80);
    }
});

loadDatabase();
