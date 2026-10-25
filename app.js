// State Variables
let db = []; 
let currentWordIndex = 0;
let batchStartIndex = 0; 
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

let totalWordsLearned = localStorage.getItem('totalLearnedBeast') ? parseInt(localStorage.getItem('totalLearnedBeast')) : 0;

// DOM Elements
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
        document.getElementById('th-meaning').textContent = "DATA ERROR";
        document.getElementById('th-meaning').classList.add('text-red-500');
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
        alert("CHALLENGE COMPLETE. YOU BEAT THE APP.");
        return;
    }

    // Reset animations
    const wordEl = document.getElementById('en-word');
    const posEl = document.getElementById('en-pos');
    wordEl.parentElement.style.animation = 'none';
    wordEl.parentElement.offsetHeight; /* trigger reflow */
    wordEl.parentElement.style.animation = null; 

    const currentWord = db[currentWordIndex];
    
    // Inject Word and POS
    wordEl.textContent = currentWord.word;
    posEl.textContent = `[${currentWord.pos}]`;
    document.getElementById('th-meaning').textContent = currentWord.thai;
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

// --- QUIZ LOGIC ---
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
    
    // Show Thai target and its POS to help distinguish homographs in the quiz
    document.getElementById('quiz-th-target').textContent = q.thai;
    document.getElementById('quiz-pos').textContent = `[${q.pos}]`;

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        // Fluid typography applied to buttons as well to ensure long distractors fit
        btn.className = "w-full py-5 px-6 rounded-xl bg-gray-900 text-[clamp(1.5rem,6vw,2rem)] font-black text-white uppercase text-center active:scale-95 transition-all truncate";
        btn.textContent = option;
        
        btn.onclick = () => handleAnswer(btn, option, q.word);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(btnElement, selectedWord, correctWord) {
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    if (selectedWord === correctWord) {
        btnElement.classList.add('correct-bg');
        score++;
    } else {
        btnElement.classList.add('wrong-bg', 'shake');
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('correct-bg');
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
    }, 1000); 
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

loadDatabase();
