let database = [];
const synth = window.speechSynthesis;

// Player State
let playerXP = 0;
let streak = 0;
let currentCard = null;
let currentCEFR = "A1";

// Ranks Mapping
const ranks = [
    { maxXP: 200, cefr: "A1", title: "Street Thug" },
    { maxXP: 400, cefr: "A2", title: "Hustler" },
    { maxXP: 600, cefr: "B1", title: "Hitman" },
    { maxXP: 800, cefr: "B2", title: "Kingpin" },
    { maxXP: 1000, cefr: "C1", title: "Boss" },
    { maxXP: 99999, cefr: "C2", title: "Godfather" }
];

// 1. Initialize Game
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        updateHUD();
        loadNextCard();
    })
    .catch(err => console.error("Error loading DB", err));

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

// 2. Load Recon (Study Phase)
function loadNextCard() {
    // Filter database for words matching the current CEFR tier
    const eligibleWords = database.filter(w => w.cefr === currentCEFR);
    
    // Fallback if tier is empty (shouldn't happen with our DB, but safe)
    const pool = eligibleWords.length > 0 ? eligibleWords : database;
    currentCard = pool[Math.floor(Math.random() * pool.length)];
    
    // UI Switch
    document.getElementById('recon-mode').style.display = 'flex';
    document.getElementById('heist-mode').style.display = 'none';

    // Populate Data
    document.getElementById('study-image').src = currentCard.image;
    document.getElementById('target-word').innerText = currentCard.word;
    document.getElementById('phonetic').innerText = currentCard.phonetic;
    document.getElementById('pos').innerText = currentCard.pos;
    document.getElementById('translation').innerText = currentCard.thai;
    document.getElementById('definition').innerText = `"${currentCard.definition}"`;
    
    // Highlight Target Word in Sentence
    const regex = new RegExp(`\\b(${currentCard.word}[a-z]*)\\b`, 'gi');
    const highlightedSentence = currentCard.sentence.replace(regex, `<span style="color: var(--gta-cyan);"><b>$1</b></span>`);
    document.getElementById('study-sentence').innerHTML = highlightedSentence;
}

// 3. Audio Engine (Anti-Overlap Micro-Delay)
function playAudio(text, rate = 1.0) {
    if (synth.speaking) synth.cancel(); 
    
    setTimeout(() => {
        const utterThis = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        
        const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
        let selectedVoice = voices.find(v => 
            v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id))
        );
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

        if (selectedVoice) utterThis.voice = selectedVoice;
        utterThis.rate = rate; 
        
        synth.speak(utterThis);
    }, 50);
}

function playWord() { playAudio(currentCard.word, 0.8); }
function playSentence() { playAudio(currentCard.sentence, 1.0); }
speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };

// 4. Enter The Heist (Quiz Phase)
function startHeist() {
    if (synth.speaking) synth.cancel();
    
    document.getElementById('recon-mode').style.display = 'none';
    document.getElementById('heist-mode').style.display = 'flex';

    document.getElementById('quiz-image').src = currentCard.image;
    
    const regex = new RegExp(`\\b${currentCard.word}[a-z]*\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = currentCard.sentence.replace(regex, `<span class="blank">_______</span>`);

    // DYNAMIC DISTRACTORS: Pull the hardcoded trick distractors from DB
    let options = shuffle([currentCard.word, ...currentCard.distractors.slice(0, 3)]);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => executeHeist(btn, opt);
        grid.appendChild(btn);
    });
}

// 5. Heist Results (Grading & XP)
function executeHeist(btn, selectedWord) {
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

    if (selectedWord === currentCard.word) {
        // MISSION PASSED
        btn.classList.add('correct');
        playerXP += 20;
        streak++;
        
        playAudio("Got it.", 1.2); 
        document.getElementById('overlay-passed').classList.add('active');
        
        setTimeout(() => {
            document.getElementById('overlay-passed').classList.remove('active');
            updateHUD();
            loadNextCard();
        }, 1500);

    } else {
        // WASTED
        btn.classList.add('wrong');
        streak = 0;
        playerXP = Math.max(0, playerXP - 10); // Penalty, but don't drop below 0
        
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === currentCard.word) b.classList.add('correct');
        });

        document.getElementById('overlay-wasted').classList.add('active');
        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            document.getElementById('overlay-wasted').classList.remove('active');
            updateHUD();
            loadNextCard(); // Force them to restudy
        }, 2000);
    }
}

// 6. HUD Logic (CEFR Calculation)
function updateHUD() {
    // Determine CEFR level and Rank based on XP
    let currentRankObj = ranks[0];
    for (let i = 0; i < ranks.length; i++) {
        if (playerXP < ranks[i].maxXP) {
            currentRankObj = ranks[i];
            break;
        }
        if (i === ranks.length - 1) currentRankObj = ranks[i]; // Max level
    }

    currentCEFR = currentRankObj.cefr;
    document.getElementById('rank-title').innerText = currentRankObj.title;
    document.getElementById('cefr-badge').innerText = currentCEFR;
    
    document.getElementById('xp-display').innerText = playerXP;
    
    // XP Bar (Loops within the current tier bracket)
    let minXP = 0;
    let maxXP = currentRankObj.maxXP;
    if(currentRankObj.title !== "Street Thug") {
        const prevRank = ranks.find(r => r.cefr === getPreviousCEFR(currentCEFR));
        minXP = prevRank.maxXP;
    }
    
    const xpPercent = ((playerXP - minXP) / (maxXP - minXP)) * 100;
    document.getElementById('xp-fill').style.width = `${Math.min(100, Math.max(0, xpPercent))}%`;

    // Wanted Stars (Streak tracking max 5)
    let starsHtml = '';
    for(let i=0; i<5; i++) { starsHtml += i < Math.min(streak, 5) ? '<span class="active">★</span>' : '☆'; }
    document.getElementById('wanted-stars').innerHTML = starsHtml;
}

function getPreviousCEFR(cefr) {
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const idx = order.indexOf(cefr);
    return idx > 0 ? order[idx - 1] : "A1";
}
