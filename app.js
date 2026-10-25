// State Variables
let db = []; 
let currentWordIndex = 0;
let batchStartIndex = 0; 
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

// Scramble Game State
let currentAnswerArray = [];
let currentSpellingIndex = 0;
let isAnimating = false; // Prevents frantic tapping during failure animation

let totalWordsLearned = localStorage.getItem('totalLearnedBeast') ? parseInt(localStorage.getItem('totalLearnedBeast')) : 0;

const views = {
    start: document.getElementById('start-view'),
    learn: document.getElementById('learning-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view'),
    topbar: document.getElementById('top-bar')
};

document.getElementById('global-progress').textContent = totalWordsLearned;

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

// --- BULLETPROOF TEXT FIT MATH ALGORITHM ---
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
    views.learn.classList.remove('hidden');
    views.learn.classList.add('flex'); 
    renderLearnView();
};

function renderLearnView() {
    if (currentWordIndex >= db.length) {
        alert("CHALLENGE COMPLETE. YOU MASTERED ALL WORDS.");
        return;
    }

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

    fitTextSync('en-word', 'word-bounds', 120);
    fitTextSync('th-meaning', 'thai-bounds', 50);
}

window.nextWord = function() {
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        startQuiz();
    } else {
        window.scrollTo(0, 0); 
        renderLearnView();
    }
};

// --- SCRAMBLE QUIZ LOGIC ---
function startQuiz() {
    views.learn.classList.add('hidden');
    views.learn.classList.remove('flex');
    views.quiz.classList.remove('hidden');
    views.quiz.classList.add('flex');
    window.scrollTo(0, 0);
    
    currentQuizIndex = 0;
    score = 0;
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    isAnimating = false;
    const q = quizQueue[currentQuizIndex];
    const correctWord = q.word.toUpperCase();
    
    // Reset State for the new word
    currentSpellingIndex = 0;
    currentAnswerArray = Array(correctWord.length).fill('_');
    
    // Render Target Thai
    document.getElementById('quiz-th-target').textContent = q.thai;
    fitTextSync('quiz-th-target', 'quiz-bounds', 35);

    // Render Answer Slots
    updateAnswerDisplay();

    // Generate Scrambled Letters
    let letters = correctWord.split('');
    // Fisher-Yates Shuffle
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    
    const poolContainer = document.getElementById('letter-pool');
    poolContainer.innerHTML = ''; 

    letters.forEach((letter, index) => {
        const btn = document.createElement('button');
        // Chunky square tile design
        btn.className = "w-14 h-16 sm:w-16 sm:h-20 rounded-lg border-b-4 border-gray-700 bg-gray-800 text-3xl sm:text-4xl font-black text-white uppercase text-center active:scale-90 active:border-b-0 active:translate-y-1 transition-all flex justify-center items-center";
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
    } else {
        displayEl.classList.add('text-white');
        displayEl.classList.remove('text-neon-red');
    }
    
    fitTextSync('answer-display', 'answer-bounds', 80);
}

function handleLetterTap(btnElement, letter, correctWord) {
    if (isAnimating) return; // Block input during failure sequence

    const expectedLetter = correctWord[currentSpellingIndex];

    if (letter === expectedLetter) {
        // Correct Tap
        currentAnswerArray[currentSpellingIndex] = letter;
        currentSpellingIndex++;
        
        // Hide the tile they just tapped
        btnElement.classList.add('hidden-tile');
        
        updateAnswerDisplay();

        // Check if word is complete
        if (currentSpellingIndex === correctWord.length) {
            isAnimating = true;
            score++;
            
            // Flash green
            document.getElementById('answer-display').classList.add('text-neon-yellow');
            setTimeout(() => {
                document.getElementById('answer-display').classList.remove('text-neon-yellow');
                currentQuizIndex++;
                if (currentQuizIndex >= 10) {
                    endQuiz();
                } else {
                    renderQuizQuestion();
                }
            }, 800);
        }
    } else {
        // WRONG TAP - NO MERCY FAIL
        isAnimating = true;
        
        // Show the wrong letter they tapped in the slot
        currentAnswerArray[currentSpellingIndex] = letter;
        updateAnswerDisplay(true); // Red text
        
        // Visual punishment
        btnElement.classList.add('wrong-bg', 'shake');
        document.body.classList.add('shake');
        
        setTimeout(() => {
            document.body.classList.remove('shake');
            // Instantly fail the batch
            score = 0; // Ensures they hit the fail screen
            endQuiz();
        }, 1000);
    }
}

function endQuiz() {
    views.quiz.classList.add('hidden');
    views.quiz.classList.remove('flex');
    views.result.classList.remove('hidden');
    views.result.classList.add('flex');
    window.scrollTo(0, 0);
    
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const scoreText = document.getElementById('final-score');
    const btn = document.getElementById('result-btn');

    scoreText.textContent = `${score}/10`;

    if (score === 10) {
        title.textContent = "YOU CRUSHED IT!";
        title.className = "text-5xl sm:text-7xl font-black uppercase mb-4 leading-none text-neon-yellow zoom-in";
        subtitle.textContent = "BATCH CLEARED";
        scoreText.className = "text-[6rem] sm:text-[9rem] font-black leading-none mb-12 text-neon-yellow";
        
        btn.textContent = "NEXT BATCH";
        btn.className = "w-full max-w-md py-6 bg-neon-blue text-black rounded-xl text-3xl font-black shadow-lg active:scale-95 transition-transform uppercase mb-8";
        
        btn.onclick = () => {
            totalWordsLearned += 10;
            localStorage.setItem('totalLearnedBeast', totalWordsLearned);
            document.getElementById('global-progress').textContent = totalWordsLearned;
            batchStartIndex = currentWordIndex;
            resetForNextRound();
        };
    } else {
        title.textContent = "FAILED";
        title.className = "text-5xl sm:text-7xl font-black uppercase mb-4 leading-none text-red-500 shake";
        subtitle.textContent = "1 MISTAKE = RESTART BATCH";
        scoreText.className = "text-[6rem] sm:text-[9rem] font-black leading-none mb-12 text-red-500";
        
        btn.textContent = "RESTART BATCH";
        btn.className = "w-full max-w-md py-6 bg-red-600 text-white rounded-xl text-3xl font-black shadow-lg active:scale-95 transition-transform uppercase mb-8";
        
        btn.onclick = () => {
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
    views.learn.classList.remove('hidden');
    views.learn.classList.add('flex');
    window.scrollTo(0, 0);
    
    renderLearnView();
}

// Recalculate if device rotated
window.addEventListener('resize', () => {
    if (!views.learn.classList.contains('hidden')) {
        fitTextSync('en-word', 'word-bounds', 120);
        fitTextSync('th-meaning', 'thai-bounds', 50);
    } else if (!views.quiz.classList.contains('hidden')) {
        fitTextSync('quiz-th-target', 'quiz-bounds', 35);
        fitTextSync('answer-display', 'answer-bounds', 80);
    }
});

loadDatabase();
