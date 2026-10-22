let sentences = [];
let reverseIndex = {}; // Maps { "clean phrase" -> [sentence objects] }

// State
let currentBubble = "flew out"; // Default starting phrase
let currentSentence = null;
let correctOrder = [];
let scrambledChunks = [];
let userDropZone = []; 
let isSolved = false;
let recentlyPlayed = []; // Prevents immediate repeats within a bubble

const synth = window.speechSynthesis;

// 1. Initialize & Build Reverse Index
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        sentences = lines.map(line => JSON.parse(line));
        
        buildReverseIndex();
        loadSentenceInBubble();
    })
    .catch(err => console.error("Error loading DB", err));

function cleanString(str) {
    // Removes punctuation and lowers case to ensure chunks match perfectly
    return str.replace(/[.,!?"]/g, '').trim().toLowerCase();
}

function buildReverseIndex() {
    reverseIndex = {};
    sentences.forEach(sentence => {
        sentence.chunks.forEach(chunk => {
            let key = cleanString(chunk);
            if (!reverseIndex[key]) reverseIndex[key] = [];
            reverseIndex[key].push(sentence);
        });
    });
}

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

// 2. Load a Sentence within the Current Bubble
function loadSentenceInBubble(forcedTargetChunk = null) {
    isSolved = false;
    userDropZone = [];
    document.getElementById('web-hint').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';

    // If user clicked a chunk to pivot, change the active bubble
    if (forcedTargetChunk) {
        currentBubble = cleanString(forcedTargetChunk);
        recentlyPlayed = []; // Reset history for new bubble
    }

    let availableSentences = reverseIndex[currentBubble] || [];
    
    // Filter out recently played sentences if we have enough options
    let eligible = availableSentences.filter(s => !recentlyPlayed.includes(s.th));
    if (eligible.length === 0) {
        recentlyPlayed = []; // Reset if we exhausted the bubble
        eligible = availableSentences;
    }

    currentSentence = eligible[Math.floor(Math.random() * eligible.length)];
    recentlyPlayed.push(currentSentence.th);

    // Update HUD
    document.getElementById('current-bubble').innerText = `"${currentBubble}"`;
    document.getElementById('bubble-count').innerText = availableSentences.length;
    document.getElementById('thai-text').innerText = currentSentence.th;

    // Prepare Chunks
    correctOrder = [...currentSentence.chunks];
    scrambledChunks = correctOrder.map((text, i) => ({ id: i, text: text }));
    scrambledChunks = shuffle(scrambledChunks);

    renderBoard();
    
    // Auto-play audio at start (Optional, but good for learning)
    // playAudio(); 
}

// 3. Render the Tap-to-Build Board
function renderBoard() {
    const bankEl = document.getElementById('word-bank');
    const zoneEl = document.getElementById('drop-zone');
    
    bankEl.innerHTML = '';
    zoneEl.innerHTML = '';

    // Render Scrambled Bank
    scrambledChunks.forEach((chunkObj, idx) => {
        const btn = document.createElement('button');
        btn.className = `chunk ${userDropZone.includes(idx) ? 'hidden' : ''}`;
        btn.innerText = chunkObj.text;
        btn.onclick = () => tapBankChunk(idx);
        bankEl.appendChild(btn);
    });

    // Render Drop Zone (User's built sentence)
    userDropZone.forEach((scrambledIdx, orderIndex) => {
        const chunkObj = scrambledChunks[scrambledIdx];
        const btn = document.createElement('button');
        
        if (isSolved) {
            // Post-Win State: Tags are green and pivot the bubble
            btn.className = 'chunk solved';
            btn.innerText = chunkObj.text;
            btn.onclick = () => loadSentenceInBubble(chunkObj.text);
        } else {
            // Building State: Click to return to bank
            btn.className = 'chunk in-zone';
            btn.innerText = chunkObj.text;
            btn.onclick = () => tapZoneChunk(orderIndex);
        }
        
        zoneEl.appendChild(btn);
    });

    // Hide bank completely if solved
    if (isSolved) bankEl.style.display = 'none';
    else bankEl.style.display = 'flex';

    if (!isSolved && userDropZone.length === correctOrder.length) {
        checkAnswer();
    }
}

// 4. Tap Interactions
function tapBankChunk(scrambledIdx) {
    if (isSolved) return;
    userDropZone.push(scrambledIdx);
    renderBoard();
}

function tapZoneChunk(orderIndex) {
    if (isSolved) return;
    userDropZone.splice(orderIndex, 1);
    renderBoard();
}

// 5. Check Answer
function checkAnswer() {
    let isCorrect = true;
    
    userDropZone.forEach((scrambledIdx, index) => {
        if (scrambledChunks[scrambledIdx].text !== correctOrder[index]) {
            isCorrect = false;
        }
    });

    if (isCorrect) {
        isSolved = true;
        
        // Show success UI
        document.getElementById('web-hint').style.display = 'block';
        document.getElementById('next-btn').style.display = 'block';
        
        if (navigator.vibrate) navigator.vibrate(50); // Haptic success
        
        renderBoard(); // Rerender as solved
        playAudio();   // Read the completed sentence

    } else {
        // Wrong order - flash red and kick them all back to bank
        const zoneEl = document.getElementById('drop-zone');
        zoneEl.style.borderColor = 'var(--gta-red)';
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Haptic error
        
        setTimeout(() => {
            zoneEl.style.borderColor = 'var(--border)';
            userDropZone = [];
            renderBoard();
        }, 500);
    }
}

// 6. Audio Engine
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    setTimeout(() => {
        const textToSpeak = correctOrder.join(' '); // Join the chunks to read full sentence
        const utterThis = new SpeechSynthesisUtterance(textToSpeak);
        const voices = synth.getVoices();
        
        const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
        let selectedVoice = voices.find(v => 
            v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id))
        );
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

        if (selectedVoice) utterThis.voice = selectedVoice;
        utterThis.rate = 0.95; 
        
        synth.speak(utterThis);
    }, 50);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
