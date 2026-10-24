// State Variables
let db = []; // Will be populated from db.jsonl
let currentWordIndex = 0;
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

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
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const text = await response.text();
        
        // Parse JSONL: split by newline, ignore empty lines, parse each string to JSON
        db = text
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => JSON.parse(line));
            
        initApp();
    } catch (error) {
        console.error("Error loading db.jsonl:", error);
        views.learn.classList.remove('hidden');
        document.getElementById('th-meaning').textContent = "⚠️ Error loading db.jsonl. Make sure you are running a local web server.";
        document.getElementById('th-meaning').classList.add('text-red-500');
    }
}

// Initialize App after DB load
function initApp() {
    views.learn.classList.remove('hidden');
    renderLearnView();
}

// --- LEARNING LOGIC ---
function renderLearnView() {
    if (currentWordIndex >= db.length) {
        alert("You have finished all words in the database!");
        return;
    }

    const currentWord = db[currentWordIndex];
    document.getElementById('en-word').textContent = currentWord.word;
    document.getElementById('th-meaning').textContent = currentWord.thai;
    document.getElementById('learn-progress').textContent = `${learnedCountInBatch + 1}/10`;
}

// Global function attached to audio button
window.playAudio = function() {
    const word = db[currentWordIndex].word;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Slightly slower for clear pronunciation
    window.speechSynthesis.speak(utterance);
};

// Global function attached to Next button
window.nextWord = function() {
    // Add current word to the upcoming quiz queue
    quizQueue.push(db[currentWordIndex]);
    
    currentWordIndex++;
    learnedCountInBatch++;

    // Trigger quiz every 10 words
    if (learnedCountInBatch === 10) {
        startQuiz();
    } else {
        renderLearnView();
    }
};

// --- QUIZ LOGIC ---
function startQuiz() {
    views.learn.classList.add('hidden');
    views.quiz.classList.remove('hidden');
    
    currentQuizIndex = 0;
    score = 0;
    
    // Shuffle the quiz questions so they aren't in the exact order they were just learned
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = quizQueue[currentQuizIndex];
    
    document.getElementById('quiz-progress').textContent = `Question ${currentQuizIndex + 1}/10`;
    
    // Replace the blank with a styled question mark
    const styledBlank = `<span class="text-indigo-500 border-b-2 border-indigo-500 px-4 py-1 mx-1 tracking-widest">?</span>`;
    document.getElementById('quiz-en-sentence').innerHTML = q.en_sentence.replace('_______', styledBlank);
    
    document.getElementById('quiz-th-hint').textContent = `Hint: ${q.th_sentence}`;

    // Prepare options (1 correct, 3 distractors) and shuffle them
    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; // Clear previous buttons

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-6 py-4 rounded-xl border-2 border-gray-100 bg-white text-lg font-medium text-gray-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all focus:outline-none";
        btn.textContent = option;
        
        btn.onclick = () => handleAnswer(btn, option, q.word);
        
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(btnElement, selectedWord, correctWord) {
    // Disable all buttons to prevent double-clicking
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    if (selectedWord === correctWord) {
        btnElement.classList.add('correct-bg', 'border-green-500');
        score++;
    } else {
        btnElement.classList.add('wrong-bg', 'border-red-500');
        // Highlight the correct answer for the user
        allBtns.forEach(b => {
            if (b.textContent === correctWord) {
                b.classList.add('correct-bg', 'border-green-500');
            }
        });
    }

    // Wait a brief moment to display the result before showing the next question
    setTimeout(() => {
        currentQuizIndex++;
        if (currentQuizIndex >= 10) {
            endQuiz();
        } else {
            renderQuizQuestion();
        }
    }, 1200);
}

function endQuiz() {
    views.quiz.classList.add('hidden');
    views.result.classList.remove('hidden');
    document.getElementById('final-score').textContent = `${score}/10`;
}

// Global function attached to Continue Learning button
window.continueLearning = function() {
    // Reset batch state
    learnedCountInBatch = 0;
    quizQueue = [];
    
    // Switch views back to learning
    views.result.classList.add('hidden');
    views.learn.classList.remove('hidden');
    
    renderLearnView();
};

// Start fetching data immediately
loadDatabase();
