let database = [];
const synth = window.speechSynthesis;

// Player State
let playerElo = 800;
let playerXP = 0;
let playerLevel = 1;
let streak = 0;
let usedHint = false;

// Current Match State
let currentSentence = null;
let startTime = 0;

// Long Press Variables for Full Thai
let pressTimer;
const LONG_PRESS_MS = 500;

// 1. Initialize
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        updateHUD();
        setupLongPress();
        loadNextMatch();
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

// 2. Adaptive Matchmaking (Find a sentence close to Player's Elo)
function loadNextMatch() {
    usedHint = false;
    document.getElementById('full-thai-overlay').style.display = 'none';

    // Find sentences within +- 150 Elo points
    let eligible = database.filter(s => Math.abs(s.elo - playerElo) <= 150);
    if (eligible.length === 0) {
        // Fallback if at extremes
        eligible = database;
    }

    currentSentence = eligible[Math.floor(Math.random() * eligible.length)];
    
    renderStage();
    startTime = Date.now();
    playAudio();
}

// 3. Render the Tap-to-Fracture Sentence
function renderStage() {
    const container = document.getElementById('sentence-container');
    container.innerHTML = '';

    currentSentence.words.forEach((wordObj, index) => {
        if (wordObj.en.replace(/[^a-zA-Z]/g, '') === currentSentence.target) {
            // Render the Blank
            const blank = document.createElement('span');
            blank.className = 'blank';
            blank.id = 'the-blank';
            blank.innerText = '____';
            container.appendChild(blank);
        } else {
            // Render Tap-to-Translate Words
            const span = document.createElement('span');
            span.className = 'tap-word';
            span.innerText = wordObj.en;
            
            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerText = wordObj.th || '?'; // Fallback if no Thai mapped
            span.appendChild(tooltip);

            // Tap listener for hint
            span.onclick = (e) => {
                e.stopPropagation(); // prevent triggering long press
                usedHint = true;
                
                // Hide other tooltips
                document.querySelectorAll('.tap-word').forEach(w => w.classList.remove('show-tooltip'));
                
                span.classList.add('show-tooltip');
                setTimeout(() => span.classList.remove('show-tooltip'), 2000);
            };

            container.appendChild(span);
        }
    });

    document.getElementById('full-thai-overlay').innerText = currentSentence.th_full;

    // Generate Distractors
    let allTargets = database.filter(s => s.target !== currentSentence.target).map(s => s.target);
    allTargets = shuffle(allTargets);
    let options = shuffle([currentSentence.target, ...allTargets.slice(0, 3)]);

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

// 4. Long Press Logic (Global Listener)
function setupLongPress() {
    const mainContainer = document.getElementById('main-container');

    mainContainer.addEventListener('touchstart', startPress);
    mainContainer.addEventListener('touchend', cancelPress);
    mainContainer.addEventListener('touchmove', cancelPress);
    
    // Mouse support for PC testing
    mainContainer.addEventListener('mousedown', startPress);
    mainContainer.addEventListener('mouseup', cancelPress);
    mainContainer.addEventListener('mouseleave', cancelPress);

    function startPress(e) {
        if(e.target.tagName === 'BUTTON') return; // Don't trigger on buttons
        pressTimer = setTimeout(() => {
            usedHint = true;
            document.getElementById('full-thai-overlay').style.display = 'block';
            if (navigator.vibrate) navigator.vibrate(50); // Haptic pop
        }, LONG_PRESS_MS);
    }

    function cancelPress() {
        clearTimeout(pressTimer);
    }
}

// 5. Grading and Elo Math
function submitAnswer(btn, selectedWord) {
    const timeTaken = (Date.now() - startTime) / 1000;
    const blank = document.getElementById('the-blank');
    blank.innerText = currentSentence.target;

    if (selectedWord === currentSentence.target) {
        // WIN
        btn.classList.add('correct');
        streak++;
        
        // Calculate XP
        let xpGained = 50;
        if (usedHint) xpGained -= 30; // Penalty for translating
        if (timeTaken < 3 && !usedHint) xpGained += 20; // Speed bonus
        
        playerXP += xpGained;
        
        // Elo Matchmaking Math (Standard K-Factor of 32)
        const expectedScore = 1 / (1 + Math.pow(10, (currentSentence.elo - playerElo) / 400));
        playerElo = Math.round(playerElo + 32 * (1 - expectedScore));

        // UI Updates
        document.getElementById('xp-gain-text').innerText = `+${xpGained} RESPECT`;
        document.getElementById('overlay-passed').classList.add('active');
        updateHUD();
        playAudio(); // Read full sentence

        setTimeout(() => {
            document.getElementById('overlay-passed').classList.remove('active');
            loadNextMatch();
        }, 1500);

    } else {
        // LOSE
        btn.classList.add('wrong');
        streak = 0;

        // Reveal correct
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === currentSentence.target) b.classList.add('correct');
        });

        // Elo Drop Math
        const expectedScore = 1 / (1 + Math.pow(10, (currentSentence.elo - playerElo) / 400));
        playerElo = Math.round(playerElo + 32 * (0 - expectedScore));

        document.getElementById('overlay-wasted').classList.add('active');
        if (navigator.vibrate) navigator.vibrate(200);
        updateHUD();

        setTimeout(() => {
            document.getElementById('overlay-wasted').classList.remove('active');
            loadNextMatch(); // Re-rolls an easier sentence due to lower Elo
        }, 2000);
    }
}

// 6. HUD Management
function updateHUD() {
    // Ranks based on Elo
    if (playerElo >= 1500) { document.getElementById('rank-title').innerText = "BOSS (Level 3)"; playerLevel = 3; }
    else if (playerElo >= 1200) { document.getElementById('rank-title').innerText = "HUSTLER (Level 2)"; playerLevel = 2; }
    else { document.getElementById('rank-title').innerText = "STREET THUG (Level 1)"; playerLevel = 1; }

    document.getElementById('elo-display').innerText = playerElo;
    document.getElementById('xp-display').innerText = playerXP;
    document.getElementById('lvl-display').innerText = playerLevel;

    // XP Bar (Loops every 1000 XP)
    const xpPercent = (playerXP % 1000) / 10;
    document.getElementById('xp-fill').style.width = `${xpPercent}%`;

    // Wanted Stars (Max 5)
    const starsEl = document.getElementById('wanted-stars');
    let starsHtml = '';
    for(let i=0; i<5; i++) {
        if (i < Math.min(streak, 5)) starsHtml += '<span class="active">★</span>';
        else starsHtml += '☆';
    }
    starsEl.innerHTML = starsHtml;
}

// 7. Text-to-Speech
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    // Speak the full English sentence (strip out punctuation for cleaner TTS)
    const textToSpeak = currentSentence.words.map(w => w.en).join(' ').replace(/[^a-zA-Z ]/g, '');
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    const voices = synth.getVoices();
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    
    let selectedVoice = voices.find(v => 
        v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id))
    );
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

    if (selectedVoice) utterThis.voice = selectedVoice;
    utterThis.rate = 1.0; 
    synth.speak(utterThis);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
