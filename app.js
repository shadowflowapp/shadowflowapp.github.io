let database = [];
let masteredWords = 0;

// Batch config
const BATCH_SIZE = 5;
let currentBatch = [];
let studyIndex = 0;
let quizIndex = 0;

const synth = window.speechSynthesis;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        document.getElementById('total-count').innerText = database.length;
        loadNextBatch();
    })
    .catch(err => console.error("Error loading DB", err));

// Utility: Shuffle
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

// 2. Load a Batch of 5 Words
function loadNextBatch() {
    // Get next unmastered words up to BATCH_SIZE
    currentBatch = database.slice(masteredWords, masteredWords + BATCH_SIZE);
    
    if (currentBatch.length === 0) {
        alert("Incredible! You are a walking COBUILD dictionary!");
        return;
    }

    studyIndex = 0;
    document.getElementById('study-mode').style.display = 'flex';
    document.getElementById('quiz-mode').style.display = 'none';
    renderStudyCard();
}

// 3. Render Study Card
function renderStudyCard() {
    const wordObj = currentBatch[studyIndex];

    document.getElementById('target-word').innerText = wordObj.word;
    document.getElementById('phonetic').innerText = wordObj.phonetic;
    document.getElementById('pos').innerText = wordObj.pos;

    // Highlight target word in COBUILD definition
    const regex = new RegExp(`\\b(${wordObj.word}[a-z]*)\\b`, 'gi');
    document.getElementById('cobuild-def').innerHTML = wordObj.cobuild.replace(regex, `<span class="target-highlight">$1</span>`);
    document.getElementById('example-sentence').innerText = `"${wordObj.example}"`;

    // Thai Toggle
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('thai-text').style.display = 'none';
    document.getElementById('thai-text').innerText = wordObj.thai;

    // Button Toggle (Next vs Quiz)
    if (studyIndex === currentBatch.length - 1) {
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

function nextStudyWord() {
    if (studyIndex < currentBatch.length - 1) {
        studyIndex++;
        renderStudyCard();
    }
}

// 4. Enter Quiz Phase (Test the whole batch)
function startQuizPhase() {
    quizIndex = 0;
    document.getElementById('study-mode').style.display = 'none';
    document.getElementById('quiz-mode').style.display = 'flex';
    renderQuizCard();
}

function renderQuizCard() {
    const wordObj = currentBatch[quizIndex];
    
    // Blank out the target word in the definition
    const regex = new RegExp(`\\b${wordObj.word}[a-z]*\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = wordObj.cobuild.replace(regex, `<span class="blank" id="quiz-blank">____</span>`);

    // Distractors: Pull 3 random words from the ENTIRE database
    let otherWords = database.filter(w => w.word !== wordObj.word).map(w => w.word);
    otherWords = shuffle(otherWords);
    let options = shuffle([wordObj.word, ...otherWords.slice(0, 3)]);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkQuizAnswer(btn, opt, wordObj.word);
        grid.appendChild(btn);
    });
}

// 5. Grade Quiz
function checkQuizAnswer(btn, selectedOption, correctAnswer) {
    const blank = document.getElementById('quiz-blank');
    blank.innerText = correctAnswer;
    blank.style.borderBottomColor = 'transparent';

    if (selectedOption === correctAnswer) {
        btn.classList.add('correct');
        blank.style.color = 'var(--correct-color)';
        
        setTimeout(() => {
            quizIndex++;
            if (quizIndex < currentBatch.length) {
                renderQuizCard();
            } else {
                // Batch Complete! Increase mastery and load next batch.
                masteredWords += currentBatch.length;
                updateProgressUI();
                loadNextBatch();
            }
        }, 800);
    } else {
        btn.classList.add('wrong');
        blank.style.color = 'var(--text-main)';

        // Highlight correct answer
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === correctAnswer) b.classList.add('correct');
        });

        // Fail condition: If they miss one, they fail the checkpoint and must restudy the batch
        setTimeout(() => {
            alert(`Oops! You missed "${correctAnswer}". Let's review this batch again.`);
            studyIndex = 0;
            document.getElementById('study-mode').style.display = 'flex';
            document.getElementById('quiz-mode').style.display = 'none';
            renderStudyCard();
        }, 2000);
    }
}

// 6. Global Progress
function updateProgressUI() {
    const total = database.length;
    document.getElementById('mastered-count').innerText = masteredWords;
    document.getElementById('progress-fill').style.width = (masteredWords / total * 100) + '%';
}

// Text-to-Speech (American Male priority)
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    // Read the Target Word, pause, then the Definition
    const wordObj = currentBatch[studyIndex];
    const textToSpeak = `${wordObj.word}. ${wordObj.cobuild}`;
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    const voices = synth.getVoices();
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    let selectedVoice = voices.find(v => v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id)));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

    if (selectedVoice) utterThis.voice = selectedVoice;
    utterThis.rate = 0.9; 
    synth.speak(utterThis);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
