let database = [];
let masteredWords = 0;

// Batch config
const BATCH_SIZE = 5;
let currentBatch = [];
let studyIndex = 0;
let quizIndex = 0;

// Initialize Web Speech API
const synth = window.speechSynthesis;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        // Parse the JSONL file line by line
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        document.getElementById('total-count').innerText = database.length;
        loadNextBatch();
    })
    .catch(err => console.error("Error loading DB", err));

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

    // Highlight the target word (and any suffixes like 's' or 'ed') in the definition
    const regex = new RegExp(`\\b(${wordObj.word}[a-z]*)\\b`, 'gi');
    document.getElementById('cobuild-def').innerHTML = wordObj.cobuild.replace(regex, `<span class="target-highlight">$1</span>`);
    
    document.getElementById('example-sentence').innerText = `"${wordObj.example}"`;

    // Reset Thai Toggle UI
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('thai-text').style.display = 'none';
    document.getElementById('thai-text').innerText = wordObj.thai;

    // Button Toggle (Next Word vs Checkpoint Quiz)
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
    
    // Blank out the EXACT grammatical answer in the definition (using wordObj.answer)
    const regex = new RegExp(`\\b${wordObj.answer}\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = wordObj.cobuild.replace(regex, `<span class="blank" id="quiz-blank">____</span>`);

    // Distractors: Pull 3 random answers from the ENTIRE database
    // We use .answer so all options fit grammatically (e.g. they all end in 's' or 'ed' if applicable)
    let otherWords = database.filter(w => w.word !== wordObj.word).map(w => w.answer);
    otherWords = shuffle(otherWords);
    
    // Combine the correct answer with 3 distractors and shuffle them
    let options = shuffle([wordObj.answer, ...otherWords.slice(0, 3)]);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        // Pass the exact grammatical answer to the validation function
        btn.onclick = () => checkQuizAnswer(btn, opt, wordObj.answer);
        grid.appendChild(btn);
    });
}

// 5. Grade Quiz Answer
function checkQuizAnswer(btn, selectedOption, correctAnswer) {
    const blank = document.getElementById('quiz-blank');
    blank.innerText = correctAnswer; // Fills the blank with perfect grammar
    blank.style.borderBottomColor = 'transparent';

    if (selectedOption === correctAnswer) {
        btn.classList.add('correct');
        blank.style.color = 'var(--correct-color)';
        
        // Progress to next quiz question automatically
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

        // Highlight the button that was actually correct
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

// 6. Global Progress UI Update
function updateProgressUI() {
    const total = database.length;
    document.getElementById('mastered-count').innerText = masteredWords;
    document.getElementById('progress-fill').style.width = (masteredWords / total * 100) + '%';
}

// 7. Text-to-Speech (American Male Priority)
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    const wordObj = currentBatch[studyIndex];
    // Read the Target Word, pause slightly, then read the Definition
    const textToSpeak = `${wordObj.word}. ${wordObj.cobuild}`;
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    const voices = synth.getVoices();
    
    // Identifiers for common Native American Male voices across operating systems
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    
    let selectedVoice = voices.find(v => 
        v.lang.includes('en-US') && 
        maleUSIdentifiers.some(id => v.name.includes(id))
    );
    
    // Fallback if no specific male name is found
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('en-US'));
    }

    if (selectedVoice) {
        utterThis.voice = selectedVoice;
    }
    
    utterThis.rate = 0.9; // Slightly slower for better learner comprehension
    synth.speak(utterThis);
}

// Browser quirk: ensure voices load fully before first play
speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
