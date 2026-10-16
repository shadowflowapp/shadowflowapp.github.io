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

// 2. Load the Next Word
function loadNextWord() {
    isAnimating = false;
    hintUsed = false;
    
    // Reset UI
    document.getElementById('hint-btn').style.display = 'block';
    document.getElementById('thai-hint').style.display = 'none';

    // Find words that are NOT yet mastered (mastery < 1)
    const unmasteredWords = database.filter(w => (w.mastery || 0) < 1);
    
    if (unmasteredWords.length === 0) {
        alert("Incredible! You have mastered the entire A batch!");
        return;
    }

    // Pick a random unmastered word
    const randomIndex = Math.floor(Math.random() * unmasteredWords.length);
    currentQuestion = unmasteredWords[randomIndex];

    // Render the COBUILD Sentence
    const blankedSentence = currentQuestion.definition.replace('____', `<span class="blank" id="blank-space">____</span>`);
    document.getElementById('english-sentence').innerHTML = blankedSentence;
    document.getElementById('thai-hint').innerText = currentQuestion.thai_hint;

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

// 3. Fading Thai Mechanic (Hint System)
function revealHint() {
    hintUsed = true; // Penalize mastery gain for this turn
    document.getElementById('hint-btn').style.display = 'none';
    document.getElementById('thai-hint').style.display = 'block';
}

// 4. Validate Answer
function checkAnswer(btn, selectedOption) {
    if (isAnimating) return;
    isAnimating = true;

    const isCorrect = (selectedOption === currentQuestion.word);
    const blankSpace = document.getElementById('blank-space');
    
    blankSpace.innerText = currentQuestion.word;
    blankSpace.style.borderBottomColor = 'transparent';

    if (isCorrect) {
        btn.classList.add('correct');
        blankSpace.style.color = 'var(--correct-color)';
        
        // Mastery Logic: Only grant mastery if they didn't use the Thai hint
        if (!hintUsed) {
            currentQuestion.mastery = 1;
            updateMasteryUI();
        }

        setTimeout(loadNextWord, 1000);
    } else {
        // Wrong Answer
        btn.classList.add('wrong');
        blankSpace.style.color = 'var(--text-main)';

        // Highlight correct answer
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === currentQuestion.word) b.classList.add('correct');
        });

        // Automatically reveal the Thai hint so they understand why they were wrong
        document.getElementById('hint-btn').style.display = 'none';
        document.getElementById('thai-hint').style.display = 'block';

        setTimeout(loadNextWord, 2500);
    }
}

// 5. Update Pokedex Progress Bar
function updateMasteryUI() {
    const totalWords = database.length;
    const masteredWords = database.filter(w => (w.mastery || 0) >= 1).length;
    
    document.getElementById('total-count').innerText = totalWords;
    document.getElementById('mastered-count').innerText = masteredWords;
    
    const percentage = (masteredWords / totalWords) * 100;
    document.getElementById('progress-fill').style.width = percentage + '%';
}
