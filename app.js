// State Variables
let db = []; 
let currentWordIndex = 0;
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

// Retrieve total learned words from LocalStorage to persist across refreshes
let totalWordsLearned = localStorage.getItem('totalLearned') ? parseInt(localStorage.getItem('totalLearned')) : 0;
document.getElementById('global-progress').textContent = totalWordsLearned;

// DOM Elements mapping
const views = {
    learn: document.getElementById('learning-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view')
};

// Fetch and parse the JSONL database
async function loadDatabase() {
    try {
        const response = await fetch('db.jsonl');
        if (!response.ok) throw new Error(`HTTP error!`);

        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
            
        initApp();
    } catch (error) {
        console.error("Error loading db.jsonl:", error);
        views.learn.classList.remove('hidden');
        document.getElementById('th-meaning').textContent = "⚠️ Error loading db.jsonl. Run via local web server.";
        document.getElementById('th-meaning').classList.add('text-red-500');
    }
}

function initApp() {
    views.learn.classList.remove('hidden');
    renderLearnView();
}

// --- LEARNING LOGIC ---
function renderLearnView() {
    if (currentWordIndex >= db.length) {
        alert("You have learned all words in the database!");
        return;
    }

    const currentWord = db[currentWordIndex];
    document.getElementById('en-word').textContent = currentWord.word;
    document.getElementById('th-meaning').textContent = currentWord.thai;
    document.getElementById('learn-progress').textContent = `${learnedCountInBatch + 1}/10`;
}

window.playAudio = function() {
    const word = db[currentWordIndex].word;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; 
    window.speechSynthesis.speak(utterance);
};

window.nextWord = function() {
    quizQueue.push(db[currentWordIndex]);
    currentWordIndex++;
    learnedCountInBatch++;

    if (learnedCountInBatch === 10) {
        startQuiz();
    } else {
        renderLearnView();
    }
};

// --- QUIZ LOGIC (THAI -> ENGLISH MATCHING) ---
function startQuiz() {
    views.learn.classList.add('hidden');
    views.quiz.classList.remove('hidden');
    
    currentQuizIndex = 0;
    score = 0;
    
    // Shuffle the queue so they appear in a random order
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = quizQueue[currentQuizIndex];
    
    document.getElementById('quiz-progress').textContent = `${currentQuizIndex + 1}/10`;
    document.getElementById('quiz-th-target').textContent = q.thai;

    // Prepare 4 options and shuffle them
    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = "w-full px-4 py-6 rounded-2xl border-2 border-gray-700 bg-gray-800 text-xl font-bold text-gray-200 shadow-sm hover:border-indigo-500 hover:bg-gray-700 transition-all focus:outline-none lowercase";
        btn.textContent = option;
        
        btn.onclick = () => handleAnswer(btn, option, q.word);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(btnElement, selectedWord, correctWord) {
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true); // Prevent multiple clicks

    if (selectedWord === correctWord) {
        btnElement.classList.add('correct-bg');
        score++;
    } else {
        btnElement.classList.add('wrong-bg');
        // Reveal the correct answer
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
            renderQuizQuestion();
        }
    }, 1000);
}

function endQuiz() {
    views.quiz.classList.add('hidden');
    views.result.classList.remove('hidden');
    document.getElementById('final-score').textContent = `${score}/10`;
    
    // Update global progress (Only strictly counting words they got correct)
    totalWordsLearned += score;
    localStorage.setItem('totalLearned', totalWordsLearned);
    document.getElementById('global-progress').textContent = totalWordsLearned;
}

window.continueLearning = function() {
    learnedCountInBatch = 0;
    quizQueue = [];
    
    views.result.classList.add('hidden');
    views.learn.classList.remove('hidden');
    
    renderLearnView();
};

loadDatabase();
