// State Variables
let db = []; 
let currentWordIndex = 0;
let batchStartIndex = 0; 
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

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
// Measures exact pixels and guarantees text fits on 1 line.
function fitTextSync(textContainerId, boundContainerId, maxFontSizePx) {
    const textEl = document.getElementById(textContainerId);
    const boundsEl = document.getElementById(boundContainerId);
    
    // Step 1: Force max size and single line
    textEl.style.fontSize = `${maxFontSizePx}px`;
    textEl.style.whiteSpace = 'nowrap';
    
    // Manage POS tag sizing if it exists
    const posTag = document.getElementById('pos-tag');
    if (posTag && textContainerId === 'en-container') {
        posTag.style.fontSize = `${maxFontSizePx * 0.4}px`;
    }

    // Step 2: Mathematically scale down if text is wider than screen container
    const textWidth = textEl.scrollWidth;
    const containerWidth = boundsEl.clientWidth;
    
    if (textWidth > containerWidth && containerWidth > 0) {
        const ratio = containerWidth / textWidth;
        const exactSafeFit = Math.floor(maxFontSizePx * ratio * 0.95); // 0.95 is 5% safety padding
        
        textEl.style.fontSize = `${exactSafeFit}px`;
        if (posTag && textContainerId === 'en-container') {
            posTag.style.fontSize = `${Math.floor(exactSafeFit * 0.4)}px`;
        }
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
        alert("CHALLENGE COMPLETE. YOU MASTERED ALL 100 WORDS.");
        return;
    }

    const currentWord = db[currentWordIndex];
    
    document.getElementById('en-word').textContent = currentWord.word;
    document.getElementById('pos-tag').textContent = currentWord.pos;
    document.getElementById('th-meaning').textContent = currentWord.thai;
    
    // Restart CSS Animations
    document.getElementById('en-container').style.animation = 'none';
    document.getElementById('th-meaning').style.animation = 'none';
    document.getElementById('en-container').offsetHeight; 
    document.getElementById('en-container').style.animation = null; 
    document.getElementById('th-meaning').style.animation = null; 

    // Apply scaling logic - Base max is 120px for word, 50px for Thai
    fitTextSync('en-container', 'word-bounds', 120);
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
    const q = quizQueue[currentQuizIndex];
    
    document.getElementById('quiz-th-target').textContent = q.thai;
    fitTextSync('quiz-th-target', 'quiz-bounds', 50);

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        // Let Tailwind handle button text overflow gracefully with truncate
        btn.className = "w-full py-6 px-4 rounded-xl border-2 border-gray-800 bg-gray-900 text-2xl sm:text-3xl font-black text-white uppercase text-center active:scale-95 transition-all truncate";
        
        if (option === q.word) {
            btn.innerHTML = `${option} <span class="text-gray-500 text-xl ml-2 lowercase">${q.pos}</span>`;
        } else {
            btn.textContent = option;
        }
        
        btn.onclick = () => handleAnswer(btn, option, q.word);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(btnElement, selectedWord, correctWord) {
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    if (selectedWord === correctWord) {
        btnElement.classList.add('correct-bg');
        btnElement.classList.remove('border-gray-800');
        score++;
    } else {
        btnElement.classList.add('wrong-bg', 'shake');
        btnElement.classList.remove('border-gray-800');
        allBtns.forEach(b => {
            if (b.textContent.includes(correctWord)) {
                b.classList.add('correct-bg');
                b.classList.remove('border-gray-800');
            }
        });
    }

    setTimeout(() => {
        currentQuizIndex++;
        if (currentQuizIndex >= 10) {
            endQuiz();
        } else {
            window.scrollTo(0, 0);
            renderQuizQuestion();
        }
    }, 1200);
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
        subtitle.textContent = "10/10 REQUIRED TO ADVANCE.";
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

// Ensure math recalculates if user rotates phone from vertical to horizontal
window.addEventListener('resize', () => {
    if (!views.learn.classList.contains('hidden')) {
        fitTextSync('en-container', 'word-bounds', 120);
        fitTextSync('th-meaning', 'thai-bounds', 50);
    } else if (!views.quiz.classList.contains('hidden')) {
        fitTextSync('quiz-th-target', 'quiz-bounds', 50);
    }
});

loadDatabase();
