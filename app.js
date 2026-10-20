let database = [];
const synth = window.speechSynthesis;

// RPG Player State
let playerXP = 0;
let playerLevel = 1;
let hearts = 3;
let currentCard = null;
let currentTier = 1;

// Titles & Realms mapping
const titles = ["Novice Explorer", "Apprentice Mage", "Brave Squire", "Adept Scholar", "Guild Master"];
const realms = {
    1: "Goblin Forest (Beginner)",
    2: "Crystal Caves (Intermediate)",
    3: "Dragon Peak (Advanced)"
};

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

// 2. Load Spellbook (Adaptive Difficulty)
function loadNextCard() {
    // Determine target tier based on player level
    // Lvl 1-2 = Tier 1, Lvl 3-4 = Tier 2, Lvl 5+ = Tier 3
    currentTier = Math.min(3, Math.ceil(playerLevel / 2));
    
    // Filter database for words matching the current tier
    const eligibleWords = database.filter(w => w.tier === currentTier);
    
    // Fallback just in case tier is empty
    const pool = eligibleWords.length > 0 ? eligibleWords : database;
    currentCard = pool[Math.floor(Math.random() * pool.length)];
    
    // Update UI
    document.getElementById('study-mode').style.display = 'flex';
    document.getElementById('quiz-mode').style.display = 'none';

    document.getElementById('study-image').src = currentCard.image;
    document.getElementById('target-word').innerText = currentCard.word;
    document.getElementById('phonetic').innerText = currentCard.phonetic;
    document.getElementById('pos').innerText = currentCard.pos;
    document.getElementById('translation').innerText = currentCard.thai;
    
    // Highlight Target Word in Sentence
    const regex = new RegExp(`\\b(${currentCard.word}[a-z]*)\\b`, 'gi');
    const highlightedSentence = currentCard.sentence.replace(regex, `<span style="color: var(--action-blue);"><b>$1</b></span>`);
    document.getElementById('study-sentence').innerHTML = highlightedSentence;
    
    updateHUD();
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

// 4. Enter Battle
function startBattle() {
    if (synth.speaking) synth.cancel();
    
    document.getElementById('study-mode').style.display = 'none';
    document.getElementById('quiz-mode').style.display = 'flex';

    document.getElementById('quiz-image').src = currentCard.image;
    
    const regex = new RegExp(`\\b${currentCard.word}\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = currentCard.sentence.replace(regex, `<span class="blank">_____</span>`);

    // DYNAMIC DISTRACTORS: Only pull distractors from the same Tier!
    let sameTierWords = database.filter(w => w.tier === currentTier && w.word !== currentCard.word).map(w => w.word);
    
    // If not enough words in tier, pull from whole DB
    if(sameTierWords.length < 3) {
        sameTierWords = database.filter(w => w.word !== currentCard.word).map(w => w.word);
    }
    
    sameTierWords = shuffle(sameTierWords);
    let options = shuffle([currentCard.word, ...sameTierWords.slice(0, 3)]);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => submitAttack(btn, opt);
        grid.appendChild(btn);
    });
}

// 5. Battle Grading
function submitAttack(btn, selectedWord) {
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

    if (selectedWord === currentCard.word) {
        // VICTORY
        btn.classList.add('correct');
        playerXP += 25;
        
        playAudio("Correct!", 1.2); 
        document.getElementById('overlay-victory').classList.add('active');
        
        setTimeout(() => {
            document.getElementById('overlay-victory').classList.remove('active');
            updateHUD();
            loadNextCard();
        }, 1500);

    } else {
        // DEFEAT
        btn.classList.add('wrong');
        hearts--;
        
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === currentCard.word) b.classList.add('correct');
        });

        document.getElementById('overlay-defeat').classList.add('active');
        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            document.getElementById('overlay-defeat').classList.remove('active');
            updateHUD();
            
            if (hearts <= 0) {
                alert("Game Over! The monsters defeated you. Restarting Realm...");
                playerXP = Math.max(0, playerXP - 50); // Penalty, but not total wipe
                hearts = 3;
                updateHUD();
            }
            loadNextCard(); 
        }, 2000);
    }
}

// 6. HUD Logic
function updateHUD() {
    playerLevel = Math.floor(playerXP / 100) + 1;
    currentTier = Math.min(3, Math.ceil(playerLevel / 2));
    
    const titleIndex = Math.min(playerLevel - 1, titles.length - 1);
    document.getElementById('player-title').innerText = titles[titleIndex];
    document.getElementById('zone-indicator').innerText = `Current Realm: ${realms[currentTier]}`;
    
    document.getElementById('lvl-display').innerText = playerLevel;
    document.getElementById('xp-display').innerText = playerXP % 100;
    
    const xpPercent = playerXP % 100;
    document.getElementById('xp-fill').style.width = `${xpPercent}%`;

    let heartsHtml = '';
    for(let i=0; i<3; i++) { heartsHtml += i < hearts ? '❤️' : '🖤'; }
    document.getElementById('hearts').innerHTML = heartsHtml;
}
