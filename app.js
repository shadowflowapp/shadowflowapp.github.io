// State Variables
let db = []; 
let currentWordIndex = 0;
let batchStartIndex = 0; // Tracks where the current 10-word batch started
let learnedCountInBatch = 0;
let quizQueue = [];
let currentQuizIndex = 0;
let score = 0;

let usMaleVoice = null;
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

// Initialize TTS Voice (Seek American Male)
function initVoice() {
    const voices = window.speechSynthesis.getVoices();
    // Prioritize voices that are English and Male-sounding. 
    // Note: Web Speech API voice names vary wildly by OS. 
    usMaleVoice = voices.find(v => v.lang === 'en-US' && /(male|guy|david|mark|alex)/i.test(v.name)) 
               || voices.find(v => v.lang === 'en-US') 
               || voices[0];
}
window.speechSynthesis.onvoiceschanged = initVoice;

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

// User Interaction to bypass Autoplay Block
window.startChallenge = function() {
    initVoice(); // Force load voice context
    views.start.classList.add('hidden');
    views.topbar.classList.remove('hidden');
    views.learn.classList.remove('hidden');
    
    // Play an empty utterance to unlock audio context on mobile iOS/Android
    const unlock = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(unlock);

    renderLearnView();
};

function renderLearnView() {
    if (currentWordIndex >= db.length) {
        alert("CHALLENGE COMPLETE. YOU BEAT THE APP.");
        return;
    }

    // Re-trigger animation by cloning and replacing
    const wordEl = document.getElementById('en-word');
    wordEl.style.animation = 'none';
    wordEl.offsetHeight; /* trigger reflow */
    wordEl.style.animation = null; 

    const currentWord = db[currentWordIndex];
    wordEl.textContent = currentWord.word;
    document.getElementById('th-meaning').textContent = currentWord.thai;
    
    // Autoplay audio for the word
    playAudio(currentWord.word);
}

function playAudio(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // kill previous
    const utterance = new SpeechSynthesisUtterance(text);
    if (usMaleVoice) utterance.voice = usMaleVoice;
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 0.9; // Deeper voice
    window.speechSynthesis.speak(utterance);
}

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

// --- QUIZ LOGIC (Vertical Choices) ---
function startQuiz() {
    views.learn.classList.add('hidden');
    views.quiz.classList.remove('hidden');
    currentQuizIndex = 0;
    score = 0;
    quizQueue = quizQueue.sort(() => Math.random() - 0.5);
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = quizQueue[currentQuizIndex];
    document.getElementById('quiz-th-target').textContent = q.thai;

    const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = ''; 

    options.forEach(option => {
        const btn = document.createElement('button');
        // Vertical layout, text-scale optimized, no borders just stark background
        btn.className = "w-full py-5 px-4 rounded-xl bg-gray-900 text-2xl sm:text-3xl font-black text-white uppercase text-center active:scale-95 transition-all truncate";
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
        playAudio(correctWord); // Speak on correct
    } else {
        btnElement.classList.add('wrong-bg', 'shake');
        // Reveal correct answer
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
    }, 1200); // Slight delay to process result
}

function endQuiz() {
    views.quiz.classList.add('hidden');
    views.result.classList.remove('hidden');
    
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const scoreText = document.getElementById('final-score');
    const btn = document.getElementById('result-btn');

    scoreText.textContent = `${score}/10`;

    if (score === 10) {
        // SUCCESS
        title.textContent = "YOU CRUSHED IT!";
        title.className = "text-6xl font-black uppercase mb-4 leading-none text-neon-yellow zoom-in";
        subtitle.textContent = "BATCH CLEARED";
        scoreText.className = "text-[7rem] font-black leading-none mb-12 text-neon-yellow";
        
        btn.textContent = "NEXT BATCH";
        btn.className = "w-full max-w-md py-6 bg-neon-blue text-black rounded-xl text-3xl font-black shadow-lg active:scale-95 transition-transform uppercase mb-8";
        
        btn.onclick = () => {
            totalWordsLearned += 10;
            localStorage.setItem('totalLearnedBeast', totalWordsLearned);
            document.getElementById('global-progress').textContent = totalWordsLearned;
            
            // Advance batch logic
            batchStartIndex = currentWordIndex;
            resetForNextRound();
        };
    } else {
        // FAIL - STRICT RULE
        title.textContent = "FAILED";
        title.className = "text-6xl font-black uppercase mb-4 leading-none text-red-500 shake";
        subtitle.textContent = "10/10 REQUIRED TO ADVANCE.";
        scoreText.className = "text-[7rem] font-black leading-none mb-12 text-red-500";
        
        btn.textContent = "RESTART BATCH";
        btn.className = "w-full max-w-md py-6 bg-red-600 text-white rounded-xl text-3xl font-black shadow-lg active:scale-95 transition-transform uppercase mb-8";
        
        btn.onclick = () => {
            // Reset to beginning of the batch
            currentWordIndex = batchStartIndex;
            resetForNextRound();
        };
    }
}

function resetForNextRound() {
    learnedCountInBatch = 0;
    quizQueue = [];
    
    views.result.classList.add('hidden');
    views.learn.classList.remove('hidden');
    
    renderLearnView();
}

// Init DB on load
loadDatabase();
