let database = [];
let currentWordIndex = 0;
let currentSentenceIndex = 0;
let masteredCount = 0;
let quizActive = false;
let currentQuizCorrectAnswer = "";

const synth = window.speechSynthesis;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        document.getElementById('total-words').innerText = database.length;
        loadWordHub(currentWordIndex);
    })
    .catch(err => console.error("Error loading JSONL DB", err));

// Utility: Shuffle Array
function shuffle(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

// 2. Load Word Hub (Study Mode)
function loadWordHub(wordIdx) {
    quizActive = false;
    document.getElementById('study-container').style.display = 'flex';
    document.getElementById('quiz-container').style.display = 'none';

    const wordData = database[wordIdx];
    document.getElementById('word-index').innerText = wordIdx + 1;
    document.getElementById('target-word').innerText = wordData.target_word;
    
    currentSentenceIndex = 0;
    renderSentence(currentSentenceIndex);
}

// 3. Render Study Card
function renderSentence(sentenceIdx) {
    const wordData = database[currentWordIndex];
    const data = wordData.sentences[sentenceIdx];
    
    document.getElementById('situation-tag').innerText = data.situation;
    document.getElementById('pos-tag').innerText = `${sentenceIdx + 1} / ${wordData.sentences.length}`;
    
    // Highlight Target Word
    const regex = new RegExp(`(${wordData.target_word}[a-z]*)`, 'gi');
    document.getElementById('english-sentence').innerHTML = data.en.replace(regex, `<span class="target-highlight">$1</span>`);
    
    // Reset Thai UI
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('thai-text').style.display = 'none';
    document.getElementById('thai-text').innerText = data.th;

    // Toggle Next vs Quiz button
    if (sentenceIdx === wordData.sentences.length - 1) {
        document.getElementById('btn-next').style.display = 'none';
        document.getElementById('btn-quiz').style.display = 'block';
    } else {
        document.getElementById('btn-next').style.display = 'block';
        document.getElementById('btn-quiz').style.display = 'none';
    }
}

function revealThai() {
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('thai-text').style.display = 'block';
}

function nextSentence() {
    if (currentSentenceIndex < database[currentWordIndex].sentences.length - 1) {
        currentSentenceIndex++;
        renderSentence(currentSentenceIndex);
    }
}

// 4. Start Mastery Quiz (Active Gamification)
function startQuiz() {
    quizActive = true;
    document.getElementById('study-container').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'flex';

    const wordData = database[currentWordIndex];
    currentQuizCorrectAnswer = wordData.target_word;

    // Pick a random sentence from the hub they just studied
    const randomSentenceData = wordData.sentences[Math.floor(Math.random() * wordData.sentences.length)];
    
    document.getElementById('quiz-situation').innerText = randomSentenceData.situation;

    // Blank out the target word
    const regex = new RegExp(`\\b${wordData.target_word}[a-z]*\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = randomSentenceData.en.replace(regex, `<span class="blank" id="quiz-blank">____</span>`);

    // Dynamically generate 3 wrong answers from OTHER words in the database
    let otherWords = database.filter(w => w.target_word !== currentQuizCorrectAnswer).map(w => w.target_word);
    otherWords = shuffle(otherWords);
    let distractors = otherWords.slice(0, 3);
    
    let options = shuffle([currentQuizCorrectAnswer, ...distractors]);

    // Render Options
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkQuizAnswer(btn, opt);
        grid.appendChild(btn);
    });
}

// 5. Grade Quiz
function checkQuizAnswer(btn, selectedOption) {
    const blank = document.getElementById('quiz-blank');
    blank.innerText = currentQuizCorrectAnswer;
    blank.style.borderBottomColor = 'transparent';

    if (selectedOption === currentQuizCorrectAnswer) {
        btn.classList.add('correct');
        blank.style.color = 'var(--correct-color)';
        
        masteredCount++;
        document.getElementById('mastered-count').innerText = masteredCount;

        setTimeout(() => {
            // Move to next word hub
            if (currentWordIndex < database.length - 1) {
                currentWordIndex++;
                loadWordHub(currentWordIndex);
            } else {
                alert("You've mastered the entire database!");
            }
        }, 1000);
    } else {
        btn.classList.add('wrong');
        blank.style.color = 'var(--text-main)';

        // Highlight correct option
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === currentQuizCorrectAnswer) b.classList.add('correct');
        });

        setTimeout(() => {
            // Force them to re-study the word if they fail
            loadWordHub(currentWordIndex);
        }, 2000);
    }
}

// Text-to-Speech
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    const textToSpeak = database[currentWordIndex].sentences[currentSentenceIndex].en;
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    const voices = synth.getVoices();
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    let selectedVoice = voices.find(v => v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id)));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

    if (selectedVoice) utterThis.voice = selectedVoice;
    utterThis.rate = 0.95; 
    synth.speak(utterThis);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
