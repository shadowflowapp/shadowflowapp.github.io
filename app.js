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

// Utility: Shuffle array elements
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// 2. Start / Reset Game
function startGame() {
    score = 0;
    lives = 3;
    document.getElementById('score').innerText = score;
    updateHearts();
    document.getElementById('game-over').style.display = 'none';
    loadNextQuestion();
}

// 3. Load Question
function loadNextQuestion() {
    isAnimating = false;
    const randomIndex = Math.floor(Math.random() * database.length);
    currentQuestion = database[randomIndex];

    // Render text
    document.getElementById('thai-translation').innerText = currentQuestion.th;
    
    // Replace the answer word with a blank span (case insensitive replace)
    const regex = new RegExp(`\\b${currentQuestion.answer}\\b`, "i");
    const blankedSentence = currentQuestion.en.replace(regex, `<span class="blank" id="blank-space">____</span>`);
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

// 4. Validate Answer
function checkAnswer(btn, selectedOption) {
    if (isAnimating) return; // Prevent clicking multiple times
    isAnimating = true;

    const isCorrect = (selectedOption === currentQuestion.answer);
    const blankSpace = document.getElementById('blank-space');

    if (isCorrect) {
        btn.classList.add('correct');
        score++;
        document.getElementById('score').innerText = score;
        
        // Fill in the blank with a smooth color transition
        blankSpace.innerText = currentQuestion.answer;
        blankSpace.style.color = 'var(--correct-color)';
        blankSpace.style.borderBottomColor = 'transparent';

        // Move to next question quickly
        setTimeout(loadNextQuestion, 800);
    } else {
        btn.classList.add('wrong');
        lives--;
        updateHearts();

        // Show the correct answer in the blank space in white, to teach them
        blankSpace.innerText = currentQuestion.answer;
        blankSpace.style.color = 'var(--text-main)';
        blankSpace.style.borderBottomColor = 'transparent';

        // Find and highlight the correct button
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
            if(b.innerText === currentQuestion.answer) b.classList.add('correct');
        });

        if (lives <= 0) {
            setTimeout(showGameOver, 1000);
        } else {
            // Give them a bit more time to read the correct answer if they got it wrong
            setTimeout(loadNextQuestion, 1500);
        }
    }
}

// 5. Update UI
function updateHearts() {
    let heartsString = "";
    for(let i=0; i<lives; i++) heartsString += "❤️";
    for(let i=lives; i<3; i++) heartsString += "🖤"; // Empty heart for lost life
    document.getElementById('hearts').innerText = heartsString;
}

function showGameOver() {
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').style.display = 'flex';
}
