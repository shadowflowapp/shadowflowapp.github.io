let database = [];
let currentMission = null;

// User Profile (Saved in LocalStorage)
let totalXP = parseInt(localStorage.getItem('mrbeast_physics_xp')) || 0;

// Session State
let lives = 3;
let streak = 0;
let isThai = false;
let questionStartTime = 0;

// 1. Initialize App
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        updateHUD();
        loadNextQuestion();
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

// 2. Load Question
function loadNextQuestion() {
    isThai = false;
    document.getElementById('translate-btn').innerText = "SHOW THAI TRANSLATION";
    
    // Pick random
    currentMission = database[Math.floor(Math.random() * database.length)];
    
    renderObjective();
    renderKeypad();
    
    questionStartTime = Date.now(); // Start timer for XP bonus
}

// 3. Render Question & Translation
function renderObjective() {
    const qText = isThai ? currentMission.th : currentMission.en;
    document.getElementById('question-text').innerText = qText;
}

function toggleLanguage() {
    isThai = !isThai;
    document.getElementById('translate-btn').innerText = isThai ? "BACK TO ENGLISH" : "SHOW THAI TRANSLATION";
    renderObjective();
}

// 4. Render 3x3 Keypad
function renderKeypad() {
    // 1 Answer + 8 Distractors
    let options = [currentMission.answer, ...currentMission.distractors.slice(0, 8)];
    options = shuffle(options);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => submitAnswer(btn, opt);
        grid.appendChild(btn);
    });
}

// 5. XP Algorithm & Grading
function submitAnswer(btn, selectedValue) {
    if (btn.classList.contains('wrong') || btn.classList.contains('correct')) return;

    const timeTaken = (Date.now() - questionStartTime) / 1000;

    if (selectedValue === currentMission.answer) {
        // CORRECT
        btn.classList.add('correct');
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        
        streak++;
        
        // --- XP ALGORITHM ---
        let baseXP = 1000;
        
        // Time Bonus: Max 500 XP if answered instantly, degrades over 10 seconds
        let timeBonus = Math.max(0, 500 - (timeTaken * 50)); 
        
        // Streak Multiplier: +0.2x per streak, max 3.0x
        let multiplier = Math.min(3.0, 1.0 + (streak * 0.2));
        
        let earnedXP = Math.floor((baseXP + timeBonus) * multiplier);
        
        // Update Globals
        totalXP += earnedXP;
        localStorage.setItem('mrbeast_physics_xp', totalXP); // Save locally for future leaderboards
        
        // Show Success
        document.getElementById('earned-xp-text').innerText = `+${earnedXP.toLocaleString()} XP`;
        document.getElementById('overlay-correct').classList.add('active');
        updateHUD();
        
        setTimeout(() => {
            document.getElementById('overlay-correct').classList.remove('active');
            loadNextQuestion();
        }, 1500);

    } else {
        // WRONG
        btn.classList.add('wrong');
        streak = 0; // Reset streak multiplier
        lives--;
        
        if (navigator.vibrate) navigator.vibrate(200);
        updateHUD();

        if (lives <= 0) {
            setTimeout(() => {
                document.getElementById('overlay-eliminated').classList.add('active');
            }, 300);
        }
    }
}

// 6. UI Updates
function updateHUD() {
    // XP
    document.getElementById('total-xp').innerText = totalXP.toLocaleString();
    
    // Streak
    let multiplier = Math.min(3.0, 1.0 + (streak * 0.2)).toFixed(1);
    document.getElementById('streak-mult').innerText = `${multiplier}x`;

    // Lives
    let heartsHtml = '';
    for (let i = 0; i < 3; i++) {
        heartsHtml += i < lives ? '❤️' : '🖤';
    }
    document.getElementById('lives-display').innerHTML = heartsHtml;
}

function restartChallenge() {
    lives = 3;
    streak = 0;
    updateHUD();
    document.getElementById('overlay-eliminated').classList.remove('active');
    loadNextQuestion();
}
