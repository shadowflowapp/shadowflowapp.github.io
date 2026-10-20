let database = [];
let currentMission = null;
let maxArmor = 3;
let currentArmor = 3;
let isThai = false;

// 1. Initialize Game
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        loadNextMission();
    })
    .catch(err => console.error("Error loading Intel DB", err));

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

// 2. Load Mission
function loadNextMission() {
    isThai = false;
    document.getElementById('decode-btn').innerText = "DECODE (TH)";
    
    // Pick a random question
    currentMission = database[Math.floor(Math.random() * database.length)];
    
    renderObjective();
    renderKeypad();
}

// 3. Render Objective (Question Text)
function renderObjective() {
    const qText = isThai ? currentMission.th : currentMission.en;
    document.getElementById('question-text').innerText = qText;
}

function toggleLanguage() {
    isThai = !isThai;
    document.getElementById('decode-btn').innerText = isThai ? "ENCRYPT (EN)" : "DECODE (TH)";
    renderObjective();
}

// 4. Render 3x3 Keypad
function renderKeypad() {
    // We need exactly 9 options: 1 answer + 8 distractors
    let options = [currentMission.answer, ...currentMission.distractors.slice(0, 8)];
    options = shuffle(options);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => executeAction(btn, opt);
        grid.appendChild(btn);
    });
}

// 5. Combat Logic (Grading)
function executeAction(btn, selectedValue) {
    // Ignore clicks if button is already marked wrong
    if (btn.classList.contains('wrong') || btn.classList.contains('correct')) return;

    if (selectedValue === currentMission.answer) {
        // TARGET ELIMINATED (Correct)
        btn.classList.add('correct');
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        
        document.getElementById('overlay-cleared').classList.add('active');
        
        setTimeout(() => {
            document.getElementById('overlay-cleared').classList.remove('active');
            loadNextMission();
        }, 1500);

    } else {
        // HIT RECEIVED (Wrong)
        btn.classList.add('wrong');
        takeDamage();
    }
}

// 6. Damage System
function takeDamage() {
    currentArmor--;
    updateArmorUI();

    // Trigger Visual Effects
    const overlay = document.getElementById('damage-overlay');
    const container = document.getElementById('main-container');

    // 1. Blood Flash
    overlay.classList.add('active');
    
    // 2. Camera Shake
    container.classList.add('shake-effect');
    
    // 3. Haptic Vibration (Supported mobiles only)
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]); // Two quick, heavy jolts
    }

    // Clean up effects after animation
    setTimeout(() => {
        overlay.classList.remove('active');
        container.classList.remove('shake-effect');
    }, 400);

    // Check Death Condition
    if (currentArmor <= 0) {
        setTimeout(() => {
            document.getElementById('overlay-kia').classList.add('active');
        }, 500);
    }
}

function updateArmorUI() {
    for (let i = 1; i <= maxArmor; i++) {
        const plate = document.getElementById(`armor-${i}`);
        if (i <= currentArmor) {
            plate.classList.remove('lost');
        } else {
            plate.classList.add('lost');
        }
    }
}

function restartGame() {
    currentArmor = maxArmor;
    updateArmorUI();
    document.getElementById('overlay-kia').classList.remove('active');
    loadNextMission();
}
