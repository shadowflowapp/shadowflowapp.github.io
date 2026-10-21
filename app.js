let database = [];
let currentMission = null;

// Player Stats (For future Auth / Leaderboard)
let careerXP = 0;
let consecutiveKills = 0; // Tracks streak

// Mission State
let maxArmor = 3;
let currentArmor = 3;
let isThai = false;
let startTime = 0;
let mistakesMade = 0;

// Prevent repeat questions recently answered
let cooldownDeck = []; 

// 1. Initialize Game
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        updateHUDStats();
        loadNextMission();
    })
    .catch(err => console.error("Error loading Intel DB", err));

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
    document.getElementById('overlay-cleared').classList.remove('active');
    
    // Reset mission parameters
    isThai = false;
    mistakesMade = 0;
    currentArmor = maxArmor;
    updateArmorUI();
    document.getElementById('decode-btn').innerText = "DECODE (TH)";
    
    // Pull a random question not in cooldown
    let eligible = database.filter(q => !cooldownDeck.includes(q.id));
    if(eligible.length === 0) {
        cooldownDeck = []; // Reset if we ran through all
        eligible = database;
    }
    
    currentMission = eligible[Math.floor(Math.random() * eligible.length)];
    cooldownDeck.push(currentMission.id);
    if(cooldownDeck.length > 5) cooldownDeck.shift(); // Keep last 5 in memory
    
    renderObjective();
    renderKeypad();
    
    startTime = Date.now(); // Start speed timer
}

// 3. Render UI
function renderObjective() {
    const qText = isThai ? currentMission.th : currentMission.en;
    document.getElementById('question-text').innerText = qText;
}

function toggleLanguage() {
    isThai = !isThai;
    document.getElementById('decode-btn').innerText = isThai ? "ENCRYPT (EN)" : "DECODE (TH)";
    renderObjective();
}

function renderKeypad() {
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

// 4. Combat Logic & XP Algorithm
function executeAction(btn, selectedValue) {
    if (btn.classList.contains('wrong') || btn.classList.contains('correct')) return;

    if (selectedValue === currentMission.answer) {
        // TARGET ELIMINATED
        btn.classList.add('correct');
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        
        calculateXPAndShowReport();

    } else {
        // HIT RECEIVED
        btn.classList.add('wrong');
        mistakesMade++;
        consecutiveKills = 0; // Streak broken
        updateHUDStats();
        takeDamage();
    }
}

function calculateXPAndShowReport() {
    const timeTaken = (Date.now() - startTime) / 1000;
    
    // Algorithm Variables
    let base = currentMission.base_xp || 100;
    
    // Speed Bonus: Max 50, decreases by 5 per second, minimum 0
    let speedBonus = mistakesMade === 0 ? Math.max(0, Math.floor(50 - (timeTaken * 2))) : 0;
    
    // Flawless Execution
    let flawlessBonus = mistakesMade === 0 ? 50 : 0;
    
    // Mistake Penalty: Base XP drops 50% for every mistake
    let penalty = mistakesMade === 1 ? Math.floor(base * 0.5) : (mistakesMade === 2 ? Math.floor(base * 0.75) : 0);
    let earnedBase = base - penalty;

    // Streak Multiplier: +0.1x per consecutive kill (Max 2.0x)
    let multiplier = Math.min(2.0, 1.0 + (consecutiveKills * 0.1));
    
    let totalMissionXP = Math.floor((earnedBase + speedBonus + flawlessBonus) * multiplier);

    // Update Career Stats
    careerXP += totalMissionXP;
    if(mistakesMade === 0) consecutiveKills++;

    updateHUDStats();

    // Populate Combat Report
    document.getElementById('rep-base').innerText = base;
    document.getElementById('rep-speed').innerText = `+${speedBonus}`;
    document.getElementById('rep-flawless').innerText = `+${flawlessBonus}`;
    document.getElementById('rep-penalty').innerText = `-${penalty}`;
    document.getElementById('rep-mult').innerText = `x${multiplier.toFixed(1)}`;
    document.getElementById('rep-total').innerText = `+${totalMissionXP}`;

    document.getElementById('overlay-cleared').classList.add('active');
}

// 5. Damage System
function takeDamage() {
    currentArmor--;
    updateArmorUI();

    const overlay = document.getElementById('damage-overlay');
    const container = document.getElementById('main-container');

    overlay.classList.add('active');
    container.classList.add('shake-effect');
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 

    setTimeout(() => {
        overlay.classList.remove('active');
        container.classList.remove('shake-effect');
    }, 400);

    if (currentArmor <= 0) {
        setTimeout(() => {
            document.getElementById('overlay-kia').classList.add('active');
        }, 500);
    }
}

// 6. State Management
function updateArmorUI() {
    for (let i = 1; i <= maxArmor; i++) {
        const plate = document.getElementById(`armor-${i}`);
        if (i <= currentArmor) plate.classList.remove('lost');
        else plate.classList.add('lost');
    }
}

function updateHUDStats() {
    document.getElementById('career-xp').innerText = careerXP.toLocaleString();
    let mult = Math.min(2.0, 1.0 + (consecutiveKills * 0.1));
    document.getElementById('streak-counter').innerText = `x${mult.toFixed(1)}`;
    if (mult > 1.0) {
        document.getElementById('streak-counter').style.color = 'var(--hud-green)';
    } else {
        document.getElementById('streak-counter').style.color = 'var(--hud-amber)';
    }
}

function redeploy() {
    document.getElementById('overlay-kia').classList.remove('active');
    loadNextMission();
}
