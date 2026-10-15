let database = [];
let currentQuestion = null;
let score = 0;
let lives = 3;
let isAnimating = false;

// 1. Initialize
fetch('db.json')
    .then(response => response.json())
    .then(data => {
        database = data;
        startGame();
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

// 2. Game Loop State
function startGame() {
    score = 0;
    lives = 3;
    document.getElementById('score').innerText = score;
    updateHearts();
    document.getElementById('game-over').style.display = 'none';
    loadNextQuestion();
}

function loadNextQuestion() {
    isAnimating = false;
    
    // Reset UI state
    document.getElementById('options-grid').style.display = 'grid';
    document.getElementById('feedback-area').style.display = 'none';

    // Pick random grammar question
    const randomIndex = Math.floor(Math.random() * database.length);
    currentQuestion = database[randomIndex];

    // Set Level Badge
    const levelTag = document.getElementById('level-tag');
    levelTag.innerText = currentQuestion.level;
    levelTag.style.backgroundColor = currentQuestion.color;

    // Render Text
    document.getElementById('thai-translation').innerText = currentQuestion.th;
    
    // Convert ____ into a styled HTML span
    const blankedSentence = currentQuestion.en.replace('____', `<span class="blank" id="blank-space">____</span>`);
    document.getElementById('english-sentence').innerHTML = blankedSentence;

    // Render options
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

// 3. Validation & Feedback
function checkAnswer(btn, selectedOption) {
    if (isAnimating) return;
    isAnimating = true;

    const isCorrect = (selectedOption === currentQuestion.answer);
    const blankSpace = document.getElementById('blank-space');
    
    // Always reveal the answer in the sentence
    blankSpace.innerText = currentQuestion.answer;
    blankSpace.style.borderBottomColor = 'transparent';

    if (isCorrect) {
        btn.classList.add('correct');
        score++;
        document.getElementById('score').innerText = score;
        blankSpace.style.color = 'var(--correct-color)';
        
        // Fast-paced auto-advance if correct
        setTimeout(loadNextQuestion, 800);
    } else {
        // Penalty
        btn.classList.add('wrong');
        lives--;
        updateHearts();
        blankSpace.style.color = 'var(--text-main)';

        // Show the user the correct button
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === currentQuestion.answer) b.classList.add('correct');
        });

        // Pause the game, hide options, show grammar rule
        setTimeout(() => {
            document.getElementById('options-grid').style.display = 'none';
            document.getElementById('explanation-text').innerText = currentQuestion.explanation;
            document.getElementById('feedback-area').style.display = 'flex';
        }, 600);
    }
}

// 4. Continue Button (Post-Feedback)
function handleContinue() {
    if (lives <= 0) {
        showGameOver();
    } else {
        loadNextQuestion();
    }
}

// 5. UI Helpers
function updateHearts() {
    let heartsString = "";
    for(let i=0; i<lives; i++) heartsString += "❤️";
    for(let i=lives; i<3; i++) heartsString += "🖤"; 
    document.getElementById('hearts').innerText = heartsString;
}

function showGameOver() {
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').style.display = 'flex';
}
