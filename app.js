let database = [];
let currentQuestionIndex = 0;
let currentQuestion = null;
let lives = 3;
let isAnimating = false;

// 1. Initialize
fetch('db.json')
    .then(response => response.json())
    .then(data => {
        database = data;
        document.getElementById('q-total').innerText = database.length;
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

// 2. Start Game
function startGame() {
    currentQuestionIndex = 0;
    lives = 3;
    updateHearts();
    document.getElementById('game-over').style.display = 'none';
    loadQuestion();
}

// 3. Load Current Question (Sequential Progression)
function loadQuestion() {
    isAnimating = false;
    
    // Check if player won
    if (currentQuestionIndex >= database.length) {
        showGameOver(true);
        return;
    }

    document.getElementById('options-grid').style.display = 'grid';
    document.getElementById('feedback-area').style.display = 'none';

    currentQuestion = database[currentQuestionIndex];
    document.getElementById('q-counter').innerText = currentQuestionIndex + 1;

    // Set Level Badge
    const levelTag = document.getElementById('level-tag');
    levelTag.innerText = currentQuestion.level;
    levelTag.style.backgroundColor = currentQuestion.color;

    // Render Math Problem
    document.getElementById('math-problem').innerText = currentQuestion.q;

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

// 4. Validation & Feedback
function checkAnswer(btn, selectedOption) {
    if (isAnimating) return;
    isAnimating = true;

    const isCorrect = (selectedOption === currentQuestion.answer);

    if (isCorrect) {
        btn.classList.add('correct');
        
        // Fast-paced auto-advance to next harder level
        setTimeout(() => {
            currentQuestionIndex++;
            loadQuestion();
        }, 800);
    } else {
        btn.classList.add('wrong');
        lives--;
        updateHearts();

        // Highlight correct answer
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === currentQuestion.answer) b.classList.add('correct');
        });

        // Pause the game, show math explanation
        setTimeout(() => {
            document.getElementById('options-grid').style.display = 'none';
            document.getElementById('explanation-text').innerText = currentQuestion.explanation;
            document.getElementById('feedback-area').style.display = 'flex';
        }, 600);
    }
}

// 5. Post-Explanation Continue
function handleContinue() {
    if (lives <= 0) {
        showGameOver(false);
    } else {
        currentQuestionIndex++;
        loadQuestion();
    }
}

// 6. UI Helpers
function updateHearts() {
    let heartsString = "";
    for(let i=0; i<lives; i++) heartsString += "❤️";
    for(let i=lives; i<3; i++) heartsString += "🖤"; 
    document.getElementById('hearts').innerText = heartsString;
}

function showGameOver(isVictory) {
    document.getElementById('end-title').innerText = isVictory ? "You Won!" : "Game Over";
    document.getElementById('final-score').innerText = currentQuestionIndex;
    document.getElementById('game-over').style.display = 'flex';
}
