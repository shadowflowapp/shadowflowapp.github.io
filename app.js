let database = [];
let currentQuestion = null;
let hintUsed = false;
let isAnimating = false;

// 1. Initialize
fetch('db.json')
    .then(response => response.json())
    .then(data => {
        database = data;
        updateMasteryUI();
        loadNextWord();
    })
    .catch(err => console.error("Error loading DB", err));

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// 2. Load the Next Native Transcript
function loadNextWord() {
    isAnimating = false;
    hintUsed = false;
    
    // Reset UI
    document.getElementById('hint-btn').style.display = 'block';
    document.getElementById('en-hint').style.display = 'none';

    // Find phrases that are NOT yet mastered
    const unmasteredWords = database.filter(w => (w.mastery || 0) < 1);
    
    if (unmasteredWords.length === 0) {
        alert("Awesome! You have mastered all phrases in this interview transcript!");
        return;
    }

    // Pick a random unmastered phrase
    const randomIndex = Math.floor(Math.random() * unmasteredWords.length);
    currentQuestion = unmasteredWords[randomIndex];

    // Render Data
    document.getElementById('source-tag').innerText = `SOURCE: ${currentQuestion.source}`;
    
    // Insert the blank into the transcript dialogue
    const blankedSentence = currentQuestion.dialogue.replace('____', `<span class="blank" id="blank-space">____</span>`);
    document.getElementById('english-sentence').innerHTML = blankedSentence;
    document.getElementById('hint-text').innerText = currentQuestion.english_hint;

    // Render Options
    const optionsGrid = document.getElementById('options-grid');
    optionsGrid.innerHTML = '';
    
    let shuffledOptions = shuffle([...currentQuestion.options]);
    shuffledOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(btn, opt);
        optionsGrid.appendChild(btn);
    });
}

// 3. Hint System (First Principles English)
function revealHint() {
    hintUsed = true; // Penalize mastery gain if they needed the definition
    document.getElementById('hint-btn').style.display = 'none';
    document.getElementById('en-hint').style.display = 'block';
}

// 4. Validate Answer
function checkAnswer(btn, selectedOption) {
    if (isAnimating) return;
    isAnimating = true;

    const isCorrect = (selectedOption === currentQuestion.phrase);
    const blankSpace = document.getElementById('blank-space');
    
    blankSpace.innerText = currentQuestion.phrase;
    blankSpace.style.borderBottomColor = 'transparent';

    if (isCorrect) {
        btn.classList.add('correct');
        blankSpace.style.color = 'var(--correct-color)';
        
        // Grant mastery only if they didn't use the English hint
        if (!hintUsed) {
            currentQuestion.mastery = 1;
            updateMasteryUI();
        }

        setTimeout(loadNextWord, 1000);
    } else {
        btn.classList.add('wrong');
        blankSpace.style.color = 'var(--text-main)';

        // Highlight correct answer
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === currentQuestion.phrase) b.classList.add('correct');
        });

        // Auto-reveal the English definition so they learn the phrase context
        document.getElementById('hint-btn').style.display = 'none';
        document.getElementById('en-hint').style.display = 'block';

        setTimeout(loadNextWord, 3000);
    }
}

// 5. Update Mastery Tracker
function updateMasteryUI() {
    const totalWords = database.length;
    const masteredWords = database.filter(w => (w.mastery || 0) >= 1).length;
    
    document.getElementById('total-count').innerText = totalWords;
    document.getElementById('mastered-count').innerText = masteredWords;
    
    const percentage = (masteredWords / totalWords) * 100;
    document.getElementById('progress-fill').style.width = percentage + '%';
}
