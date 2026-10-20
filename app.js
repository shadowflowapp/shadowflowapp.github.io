let database = [];
const synth = window.speechSynthesis;

// Player State
let playerElo = 800;
let playerXP = 0;
let playerLevel = 1;
let streak = 0;
let usedHint = false;
let startTime = 0;

// Game Systems
let currentSentence = null;
let correctChunksOrder = [];
let scrambledChunks = [];
let userDropZone = []; 

// System 4: Cooldown Deck (Prevents repeats)
let cooldownDeck = []; 
const COOLDOWN_LIMIT = 15; 

// 1. Initialize
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        updateHUD();
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

// 2. Adaptive Matchmaking with Cooldown Filter
function loadNextMatch() {
    usedHint = false;
    document.getElementById('reveal-btn').style.display = 'flex';
    document.getElementById('thai-text').style.display = 'none';

    // Find sentences within +- 150 Elo points, EXCLUDING the cooldown deck
    let eligible = database.filter(s => 
        Math.abs(s.elo - playerElo) <= 150 && 
        !cooldownDeck.includes(s.id)
    );

    // Fallback: If we run out of eligible cards (rare, but possible), expand criteria
    if (eligible.length === 0) {
        eligible = database.filter(s => !cooldownDeck.includes(s.id));
        if (eligible.length === 0) {
            cooldownDeck = []; // Emergency reset if they beat the whole database
            eligible = database;
        }
    }

    currentSentence = eligible[Math.floor(Math.random() * eligible.length)];
    
    // Add to Cooldown Deck
    cooldownDeck.push(currentSentence.id);
    if (cooldownDeck.length > COOLDOWN_LIMIT) {
        cooldownDeck.shift(); // Remove the oldest ID from cooldown
    }

    // Setup Chunks
    correctChunksOrder = currentSentence.chunks.map(c => c.en);
    scrambledChunks = correctChunksOrder.map((text, i) => ({ id: i, text: text }));
    scrambledChunks = shuffle(scrambledChunks);
    userDropZone = [];

    document.getElementById('thai-text').innerText = currentSentence.th_full;

    renderBoard();
    startTime = Date.now();
    
    // Play Briefing Audio when card loads
    playAudio(false);
}

// 3. Render Boards
function renderBoard() {
    const bankEl = document.getElementById('chunks-bank');
    const zoneEl = document.getElementById('drop-zone');
    
    bankEl.innerHTML = '';
    zoneEl.innerHTML = '';

    // Render Bank
    scrambledChunks.forEach((chunkObj, idx) => {
        const btn = document.createElement('button');
        btn.className = `chunk-btn ${userDropZone.includes(idx) ? 'hidden' : ''}`;
        btn.innerText = chunkObj.text;
        btn.onclick = () => tapBankChunk(idx);
        bankEl.appendChild(btn);
    });

    // Render Drop Zone
    userDropZone.forEach((scrambledIdx, orderIndex) => {
        const chunkObj = scrambledChunks[scrambledIdx];
        const btn = document.createElement('button');
        btn.className = 'chunk-btn in-zone';
        btn.innerText = chunkObj.text;
        btn.onclick = () => tapZoneChunk(orderIndex);
        zoneEl.appendChild(btn);
    });

    // Auto-Check if Drop Zone is full
    if (userDropZone.length === correctChunksOrder.length) {
        checkAnswer();
    }
}

// 4. Tap Interactions
function tapBankChunk(scrambledIdx) {
    userDropZone.push(scrambledIdx);
    renderBoard();
}

function tapZoneChunk(orderIndex) {
    userDropZone.splice(orderIndex, 1);
    renderBoard();
}

// 5. Check Answer
function checkAnswer() {
    let isCorrect = true;
    
    userDropZone.forEach((scrambledIdx, index) => {
        if (scrambledChunks[scrambledIdx].text !== correctChunksOrder[index]) {
            isCorrect = false;
        }
    });

    const timeTaken = (Date.now() - startTime) / 1000;

    if (isCorrect) {
        // WIN
        streak++;
        
        let xpGained = 50;
        if (usedHint) xpGained -= 30;
        if (timeTaken < 5 && !usedHint) xpGained += 20;
        playerXP += xpGained;
        
        const expectedScore = 1 / (1 + Math.pow(10, (currentSentence.elo - playerElo) / 400));
        playerElo = Math.round(playerElo + 32 * (1 - expectedScore));

        document.getElementById('xp-gain-text').innerText = `+${xpGained} RESPECT`;
        document.getElementById('overlay-passed').classList.add('active');
        updateHUD();
        
        // System 5: Wait-to-Speak Event Listener
        // Pass 'true' to trigger the loadNextMatch() ONLY after audio ends
        playAudio(true); 

    } else {
        // LOSE
        streak = 0;
        
        const expectedScore = 1 / (1 + Math.pow(10, (currentSentence.elo - playerElo) / 400));
        playerElo = Math.round(playerElo + 32 * (0 - expectedScore));

        document.getElementById('overlay-wasted').classList.add('active');
        if (navigator.vibrate) navigator.vibrate(200);
        updateHUD();

        setTimeout(() => {
            document.getElementById('overlay-wasted').classList.remove('active');
            userDropZone = []; // Reset their chunks
            renderBoard();
        }, 1500);
    }
}

// 6. Subtitles Toggle
function revealThai() {
    usedHint = true;
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('thai-text').style.display = 'block';
}

// 7. HUD Management
function updateHUD() {
    if (playerElo >= 1600) { document.getElementById('rank-title').innerText = "BOSS (Level 3)"; playerLevel = 3; }
    else if (playerElo >= 1200) { document.getElementById('rank-title').innerText = "HUSTLER (Level 2)"; playerLevel = 2; }
    else { document.getElementById('rank-title').innerText = "STREET THUG (Level 1)"; playerLevel = 1; }

    document.getElementById('elo-display').innerText = playerElo;
    
    const xpPercent = (playerXP % 1000) / 10;
    document.getElementById('xp-fill').style.width = `${xpPercent}%`;

    const starsEl = document.getElementById('wanted-stars');
    let starsHtml = '';
    for(let i=0; i<5; i++) {
        if (i < Math.min(streak, 5)) starsHtml += '<span class="active">★</span>';
        else starsHtml += '☆';
    }
    starsEl.innerHTML = starsHtml;
}

// 8. Event-Driven Audio (Anti-Overlap & Auto-Advance)
function playAudio(isWinSequence = false) {
    if (synth.speaking) synth.cancel(); 
    
    // Tiny delay ensures the buffer is cleared before sending the new speech command
    setTimeout(() => {
        const textToSpeak = correctChunksOrder.join(' ').replace(/[^a-zA-Z0-9 ]/g, '');
        const utterThis = new SpeechSynthesisUtterance(textToSpeak);
        
        const voices = synth.getVoices();
        const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
        
        let selectedVoice = voices.find(v => 
            v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id))
        );
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

        if (selectedVoice) utterThis.voice = selectedVoice;
        utterThis.rate = 1.0; 
        
        // This is the Magic: Wait for audio to finish before advancing the game
        if (isWinSequence) {
            utterThis.onend = () => {
                document.getElementById('overlay-passed').classList.remove('active');
                loadNextMatch();
            };
            // Fallback just in case the browser's speech synthesis engine hangs
            setTimeout(() => {
                if (document.getElementById('overlay-passed').classList.contains('active')) {
                    document.getElementById('overlay-passed').classList.remove('active');
                    loadNextMatch();
                }
            }, 5000);
        }

        synth.speak(utterThis);
    }, 50);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
