let database = [];
const synth = window.speechSynthesis;

let playerXP = 0;
let currentPatternObj = null;
let currentFillerIndex = 0;

// Quiz State
let quizQuestion = null;

// 1. Initialize
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        loadNextPattern();
    })
    .catch(err => console.error("Error loading DB", err));

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

// 2. Load Study Mode
function loadNextPattern() {
    // Pick a random pattern structure
    currentPatternObj = database[Math.floor(Math.random() * database.length)];
    currentFillerIndex = 0; // Reset swipe index
    
    document.getElementById('study-mode').style.display = 'flex';
    document.getElementById('quiz-mode').style.display = 'none';

    document.getElementById('level-display').innerText = currentPatternObj.level;
    document.getElementById('pattern-desc').innerText = currentPatternObj.description;

    renderCurrentSwipe();
    
    // Auto-play first variation
    setTimeout(playAudio, 500);
}

// 3. Render the Swiped Sentence
function renderCurrentSwipe() {
    const fillerObj = currentPatternObj.fillers[currentFillerIndex];
    
    // Inject the word into the template blank
    // If the template has multiple blanks separated by '|', we split it
    let displayHtml = currentPatternObj.pattern;
    const wordParts = fillerObj.word.split(' | ');
    
    if (wordParts.length === 1) {
        displayHtml = displayHtml.replace('____', `<span class="filler-slot">${fillerObj.word}</span>`);
    } else {
        // Handle double blanks (e.g. "No matter how ____, I will ____")
        wordParts.forEach(part => {
            displayHtml = displayHtml.replace('____', `<span class="filler-slot">${part}</span>`);
        });
    }

    document.getElementById('sentence-display').innerHTML = displayHtml;
    document.getElementById('thai-translation').innerText = fillerObj.th;
}

// Navigation (Swipe left/right)
function nextFiller() {
    currentFillerIndex = (currentFillerIndex + 1) % currentPatternObj.fillers.length;
    renderCurrentSwipe();
    playAudio();
}

function prevFiller() {
    currentFillerIndex = (currentFillerIndex - 1 + currentPatternObj.fillers.length) % currentPatternObj.fillers.length;
    renderCurrentSwipe();
    playAudio();
}

// 4. Audio Engine
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    setTimeout(() => {
        const fillerObj = currentPatternObj.fillers[currentFillerIndex];
        
        let textToSpeak = currentPatternObj.pattern;
        const wordParts = fillerObj.word.split(' | ');
        wordParts.forEach(part => {
            textToSpeak = textToSpeak.replace('____', part);
        });

        const utterThis = new SpeechSynthesisUtterance(textToSpeak);
        
        const voices = synth.getVoices();
        const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
        let selectedVoice = voices.find(v => v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id)));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

        if (selectedVoice) utterThis.voice = selectedVoice;
        utterThis.rate = 1.0; 
        
        synth.speak(utterThis);
    }, 50);
}
speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };


// 5. Enter Quiz Mode
function startQuiz() {
    if (synth.speaking) synth.cancel();
    
    document.getElementById('study-mode').style.display = 'none';
    document.getElementById('quiz-mode').style.display = 'flex';

    // Pick a random variation from the current pattern to test
    quizQuestion = currentPatternObj.fillers[Math.floor(Math.random() * currentPatternObj.fillers.length)];

    document.getElementById('quiz-target-thai').innerText = quizQuestion.th;
    
    // Show template with blank
    document.getElementById('quiz-template').innerHTML = currentPatternObj.pattern.replace(/____/g, '<span class="quiz-blank">______</span>');

    // Create distractors (Pulling other fillers from the same pattern)
    let distractors = currentPatternObj.fillers.filter(f => f.word !== quizQuestion.word).map(f => f.word);
    distractors = shuffle(distractors);
    
    let options = shuffle([quizQuestion.word, ...distractors.slice(0, 3)]);

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

// 6. Grading
function checkQuizAnswer(btn, selectedWord) {
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

    if (selectedWord === quizQuestion.word) {
        // Correct
        btn.classList.add('correct');
        playerXP += 20;
        document.getElementById('xp-display').innerText = playerXP;
        
        // Read the full correct sentence aloud
        let textToSpeak = currentPatternObj.pattern;
        const wordParts = quizQuestion.word.split(' | ');
        wordParts.forEach(part => { textToSpeak = textToSpeak.replace('____', part); });
        
        if (synth.speaking) synth.cancel();
        setTimeout(() => {
            const utterThis = new SpeechSynthesisUtterance(textToSpeak);
            synth.speak(utterThis);
        }, 50);

        setTimeout(() => {
            loadNextPattern();
        }, 1500);

    } else {
        // Wrong
        btn.classList.add('wrong');
        
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === quizQuestion.word) b.classList.add('correct');
        });

        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            // Force user back to study mode for this specific pattern
            document.getElementById('study-mode').style.display = 'flex';
            document.getElementById('quiz-mode').style.display = 'none';
        }, 2000);
    }
}
