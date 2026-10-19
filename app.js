let database = [];
let currentMissionIndex = 0;

// Game State
let correctChunksOrder = [];
let scrambledChunks = [];
let userDropZone = []; // Stores the indices of the chunks the user has tapped

const synth = window.speechSynthesis;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        // Shuffle the database so missions are random
        database = shuffle(database);
        
        loadMission(currentMissionIndex);
    })
    .catch(err => console.error("Error loading DB", err));

// Utility: Shuffle Array
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
function loadMission(index) {
    const missionData = database[index];
    
    // Reset HUD & Overlays
    document.getElementById('mission-word').innerText = missionData.root;
    document.getElementById('overlay-passed').classList.remove('active');
    document.getElementById('overlay-wasted').classList.remove('active');
    updateStars();

    // Reset Subtitles
    document.getElementById('reveal-btn').style.display = 'flex';
    document.getElementById('thai-text').style.display = 'none';
    document.getElementById('thai-text').innerText = missionData.th;

    // Setup Chunks
    correctChunksOrder = [...missionData.chunks];
    
    // Create an array of objects to track original text and scrambled ID
    scrambledChunks = correctChunksOrder.map((text, i) => ({ id: i, text: text }));
    scrambledChunks = shuffle(scrambledChunks);
    
    userDropZone = [];

    renderBoard();
    
    // Auto-play the briefing audio when mission starts
    setTimeout(playAudio, 500);
}

// 3. Render the Boards (Bank and Drop Zone)
function renderBoard() {
    const bankEl = document.getElementById('chunks-bank');
    const zoneEl = document.getElementById('drop-zone');
    
    bankEl.innerHTML = '';
    zoneEl.innerHTML = '';

    // Render Bank (Hidden if it's currently in the drop zone)
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
    // Add to drop zone
    userDropZone.push(scrambledIdx);
    renderBoard();
}

function tapZoneChunk(orderIndex) {
    // Remove from drop zone
    userDropZone.splice(orderIndex, 1);
    renderBoard();
}

// 5. Check Answer
function checkAnswer() {
    let isCorrect = true;
    
    // Compare user's placed chunks with the correct order
    userDropZone.forEach((scrambledIdx, index) => {
        if (scrambledChunks[scrambledIdx].text !== correctChunksOrder[index]) {
            isCorrect = false;
        }
    });

    if (isCorrect) {
        // Mission Passed!
        document.getElementById('overlay-passed').classList.add('active');
        playAudio(); // Play the full sentence again for reinforcement
    } else {
        // Wasted!
        document.getElementById('overlay-wasted').classList.add('active');
        
        // Shake the phone if supported (Haptic feedback)
        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            document.getElementById('overlay-wasted').classList.remove('active');
            userDropZone = []; // Reset their attempt
            renderBoard();
        }, 1500);
    }
}

// 6. Next Mission
function nextMission() {
    currentMissionIndex++;
    if (currentMissionIndex >= database.length) {
        alert("YOU BEAT THE GAME. RESPECT: 100%");
        currentMissionIndex = 0;
        database = shuffle(database);
    }
    loadMission(currentMissionIndex);
}

// 7. Subtitles Toggle
function revealThai() {
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('thai-text').style.display = 'block';
}

// 8. HUD Stars
function updateStars() {
    // Just a fun visual: light up a star for every 2 missions passed
    const starsEl = document.getElementById('wanted-stars');
    const activeCount = (currentMissionIndex % 5) + 1;
    let starsHtml = '';
    for(let i=0; i<5; i++) {
        if (i < activeCount) starsHtml += '<span class="active">★</span>';
        else starsHtml += '☆';
    }
    starsEl.innerHTML = starsHtml;
}

// 9. Text-to-Speech (American Male Priority)
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    const textToSpeak = database[currentMissionIndex].en;
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    const voices = synth.getVoices();
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    
    let selectedVoice = voices.find(v => 
        v.lang.includes('en-US') && 
        maleUSIdentifiers.some(id => v.name.includes(id))
    );
    
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('en-US'));
    }

    if (selectedVoice) {
        utterThis.voice = selectedVoice;
    }
    
    // Speed set to 1.0 (Native pace) to train listening skills
    utterThis.rate = 1.0; 
    synth.speak(utterThis);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
