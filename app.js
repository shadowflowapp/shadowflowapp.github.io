let database = [];
const synth = window.speechSynthesis;

// RPG Player State
let playerXP = 0;
let playerLevel = 1;
let hearts = 3;
let currentCard = null;

// Ranks
const titles = [
    "Novice Explorer", 
    "Apprentice Mage", 
    "Brave Squire", 
    "Adept Scholar", 
    "Guild Master"
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

// 2. Load Spellbook (Study Phase)
function loadNextCard() {
    // Pick random card
    currentCard = database[Math.floor(Math.random() * database.length)];
    
    // UI Switch
    document.getElementById('study-mode').style.display = 'flex';
    document.getElementById('quiz-mode').style.display = 'none';

    // Populate Study Data
    document.getElementById('study-image').src = currentCard.image;
    document.getElementById('target-word').innerText = currentCard.word;
    document.getElementById('phonetic').innerText = currentCard.phonetic;
    document.getElementById('pos').innerText = currentCard.pos;
    document.getElementById('translation').innerText = currentCard.thai;
    
    // Highlight the target word in the sentence
    const regex = new RegExp(`\\b(${currentCard.word}[a-z]*)\\b`, 'gi');
    const highlightedSentence = currentCard.sentence.replace(regex, `<span style="color: var(--action-blue);"><b>$1</b></span>`);
    document.getElementById('study-sentence').innerHTML = highlightedSentence;
}

// 3. Audio Engine (Dual Buttons)
function playAudio(text, rate = 1.0) {
    if (synth.speaking) synth.cancel(); 
    
    setTimeout(() => {
        const utterThis = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        
        // Ensure American English (Family-friendly tone)
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

function playWord() {
    playAudio(currentCard.word, 0.9); // Slower for pronunciation
}

function playSentence() {
    playAudio(currentCard.sentence, 1.0); // Native speed
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };

// 4. Enter Battle (Quiz Phase)
function startBattle() {
    if (synth.speaking) synth.cancel();
    
    document.getElementById('study-mode').style.display = 'none';
    document.getElementById('quiz-mode').style.display = 'flex';

    // Populate Quiz Data
    document.getElementById('quiz-image').src = currentCard.image;
    
    // Create Blank Sentence
    const regex = new RegExp(`\\b${currentCard.word}\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = currentCard.sentence.replace(regex, `<span class="blank">_____</span>`);

    // Generate Multiple Choice
    let allWords = database.filter(w => w.word !== currentCard.word).map(w => w.word);
    allWords = shuffle(allWords);
    let options = shuffle([currentCard.word, ...allWords.slice(0, 3)]);

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

// 5. Battle Results (Grading & XP)
function submitAttack(btn, selectedWord) {
    // Disable further clicks
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

    if (selectedWord === currentCard.word) {
        // VICTORY
        btn.classList.add('correct');
        playerXP += 20;
        
        playAudio("Correct!", 1.2); // Small feedback
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
        
        // Show correct answer
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === currentCard.word) b.classList.add('correct');
        });

        document.getElementById('overlay-defeat').classList.add('active');
        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            document.getElementById('overlay-defeat').classList.remove('active');
            updateHUD();
            
            if (hearts <= 0) {
                alert("Game Over! The monsters defeated you. You will restart at Level 1.");
                playerXP = 0;
                hearts = 3;
                updateHUD();
            }
            loadNextCard(); // Force them to restudy
        }, 2000);
    }
}

// 6. RPG HUD Logic
function updateHUD() {
    // Level Up Math (Every 100 XP is a level)
    playerLevel = Math.floor(playerXP / 100) + 1;
    
    // Assign Title
    const titleIndex = Math.min(playerLevel - 1, titles.length - 1);
    document.getElementById('player-title').innerText = titles[titleIndex];
    
    // Update Texts
    document.getElementById('lvl-display').innerText = playerLevel;
    document.getElementById('xp-display').innerText = playerXP % 100;
    
    // XP Bar Visual
    const xpPercent = playerXP % 100;
    document.getElementById('xp-fill').style.width = `${xpPercent}%`;

    // Hearts Visual
    let heartsHtml = '';
    for(let i=0; i<3; i++) {
        heartsHtml += i < hearts ? '❤️' : '🖤';
    }
    document.getElementById('hearts').innerHTML = heartsHtml;
}
