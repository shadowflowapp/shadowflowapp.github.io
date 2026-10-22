let sentences = [];
let reverseIndex = {}; 

// State
let currentBubble = ""; 
let sentencesInBubble = [];
let currentIndex = 0;

let currentSentence = null;
let correctOrder = [];
let scrambledChunks = [];
let userDropZone = []; 
let isSolved = false;

// Touch/Swipe variables
let touchstartX = 0;
let touchendX = 0;

const synth = window.speechSynthesis;

// 1. Initialize & Build Reverse Index
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        sentences = lines.map(line => JSON.parse(line));
        
        buildReverseIndex();
        loadRandomStartingBubble();
        setupSwipeListeners();
    })
    .catch(err => console.error("Error loading DB", err));

function cleanString(str) {
    return str.replace(/[.,!?"]/g, '').trim().toLowerCase();
}

function buildReverseIndex() {
    reverseIndex = {};
    sentences.forEach(sentence => {
        sentence.chunks.forEach(chunk => {
            let key = cleanString(chunk);
            if (!reverseIndex[key]) reverseIndex[key] = [];
            // Avoid pushing duplicate sentences to the same key
            if (!reverseIndex[key].some(s => s.th === sentence.th)) {
                reverseIndex[key].push(sentence);
            }
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

// 2. Bubble Navigation
function loadRandomStartingBubble() {
    const allPhrases = Object.keys(reverseIndex);
    // Filter out phrases that only have 1 sentence to ensure a good starting experience
    const densePhrases = allPhrases.filter(key => reverseIndex[key].length > 1);
    const pool = densePhrases.length > 0 ? densePhrases : allPhrases;
    
    const randomPhrase = pool[Math.floor(Math.random() * pool.length)];
    loadBubble(randomPhrase);
}

function loadBubble(phrase) {
    currentBubble = cleanString(phrase);
    sentencesInBubble = reverseIndex[currentBubble] || [];
    sentencesInBubble = shuffle([...sentencesInBubble]); // Shuffle order for freshness
    currentIndex = 0;
    
    document.getElementById('current-bubble').innerText = `"${currentBubble}"`;
    renderCurrentSentence();
}

// 3. Render Current Sentence
function renderCurrentSentence(slideDirection = 'none') {
    isSolved = false;
    userDropZone = [];
    document.getElementById('web-hint').style.display = 'none';

    currentSentence = sentencesInBubble[currentIndex];
    
    document.getElementById('progress-counter').innerText = `${currentIndex + 1} / ${sentencesInBubble.length}`;
    document.getElementById('thai-text').innerText = currentSentence.th;

    // Prepare Chunks
    correctOrder = [...currentSentence.chunks];
    scrambledChunks = correctOrder.map((text, i) => ({ id: i, text: text }));
    scrambledChunks = shuffle(scrambledChunks);

    // Optional Transition Animation
    const card = document.getElementById('mission-card');
    if (slideDirection !== 'none') {
        card.style.opacity = '0';
        card.style.transform = slideDirection === 'left' ? 'translateX(20px)' : 'translateX(-20px)';
        setTimeout(() => {
            renderBoard();
            card.style.opacity = '1';
            card.style.transform = 'translateX(0)';
        }, 200);
    } else {
        renderBoard();
    }
}

// 4. Render Tap-to-Build Board
function renderBoard() {
    const bankEl = document.getElementById('word-bank');
    const zoneEl = document.getElementById('drop-zone');
    
    bankEl.innerHTML = '';
    zoneEl.innerHTML = '';

    // Bank
    scrambledChunks.forEach((chunkObj, idx) => {
        const btn = document.createElement('button');
        btn.className = `chunk ${userDropZone.includes(idx) ? 'hidden' : ''}`;
        btn.innerText = chunkObj.text;
        btn.onclick = () => tapBankChunk(idx);
        bankEl.appendChild(btn);
    });

    // Drop Zone
    userDropZone.forEach((scrambledIdx, orderIndex) => {
        const chunkObj = scrambledChunks[scrambledIdx];
        const btn = document.createElement('button');
        
        if (isSolved) {
            btn.className = 'chunk solved';
            btn.innerText = chunkObj.text;
            btn.onclick = () => loadBubble(chunkObj.text); // Pivot to new bubble
        } else {
            btn.className = 'chunk in-zone';
            btn.innerText = chunkObj.text;
            btn.onclick = () => tapZoneChunk(orderIndex);
        }
        
        zoneEl.appendChild(btn);
    });

    if (isSolved) bankEl.style.display = 'none';
    else bankEl.style.display = 'flex';

    if (!isSolved && userDropZone.length === correctOrder.length) {
        checkAnswer();
    }
}

// 5. Interactions
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

function checkAnswer() {
    let isCorrect = true;
    userDropZone.forEach((scrambledIdx, index) => {
        if (scrambledChunks[scrambledIdx].text !== correctOrder[index]) {
            isCorrect = false;
        }
    });

    if (isCorrect) {
        isSolved = true;
        document.getElementById('web-hint').style.display = 'block';
        if (navigator.vibrate) navigator.vibrate(50);
        renderBoard(); 
        playAudio(); 
    } else {
        const zoneEl = document.getElementById('drop-zone');
        zoneEl.style.borderColor = 'var(--gta-red)';
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
        
        setTimeout(() => {
            zoneEl.style.borderColor = 'var(--border)';
            userDropZone = [];
            renderBoard();
        }, 400);
    }
}

// 6. Swipe Gestures
function setupSwipeListeners() {
    const stage = document.getElementById('swipe-stage');
    
    stage.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, {passive: true});
    
    stage.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    }, {passive: true});
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchstartX - touchendX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe Left -> Next
            currentIndex = (currentIndex + 1) % sentencesInBubble.length;
            renderCurrentSentence('left');
        } else {
            // Swipe Right -> Prev
            currentIndex = (currentIndex - 1 + sentencesInBubble.length) % sentencesInBubble.length;
            renderCurrentSentence('right');
        }
    }
}

// 7. Audio Engine
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    setTimeout(() => {
        const textToSpeak = correctOrder.join(' ');
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
