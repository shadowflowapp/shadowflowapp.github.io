let database = [];
const synth = window.speechSynthesis;

// Player State
let playerXP = 0;
let streak = 0;
let currentMission = null;

// 1. Initialize
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        updateHUD();
        loadNextMission();
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
function loadNextMission() {
    // Pick random sentence from DB
    currentMission = database[Math.floor(Math.random() * database.length)];

    // Render Intel
    document.getElementById('thai-meaning').innerText = currentMission.th;
    
    // Render the Template with the visual blank slot
    const templateHTML = currentMission.en_template.replace(
        '[ _____ ]', 
        '<span class="blank-slot" id="blank-slot">_____</span>'
    );
    document.getElementById('english-template').innerHTML = templateHTML;

    // Generate 4 Options (1 Answer + 3 Distractors)
    let options = shuffle([currentMission.answer, ...currentMission.distractors.slice(0, 3)]);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => executeDecryption(btn, opt);
        grid.appendChild(btn);
    });
}

// 3. Game Logic
function executeDecryption(btn, selectedPhrase) {
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

    const blankSlot = document.getElementById('blank-slot');
    blankSlot.innerText = selectedPhrase;

    if (selectedPhrase === currentMission.answer) {
        // WIN
        btn.classList.add('correct');
        playerXP += 20;
        streak++;
        
        document.getElementById('overlay-passed').classList.add('active');
        
        // Play audio of full sentence immediately on win
        playAudio(currentMission.en_full);
        
        setTimeout(() => {
            document.getElementById('overlay-passed').classList.remove('active');
            updateHUD();
            loadNextMission();
        }, 2000);

    } else {
        // LOSE
        btn.classList.add('wrong');
        streak = 0;
        
        // Reveal the correct answer to the user
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === currentMission.answer) b.classList.add('correct');
        });
        blankSlot.innerText = currentMission.answer; // Show correct word in blank
        blankSlot.style.color = 'var(--gta-green)';
        blankSlot.style.borderBottomColor = 'var(--gta-green)';

        document.getElementById('overlay-wasted').classList.add('active');
        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            document.getElementById('overlay-wasted').classList.remove('active');
            updateHUD();
            loadNextMission(); 
        }, 2500);
    }
}

// 4. Update HUD
function updateHUD() {
    document.getElementById('xp-display').innerText = `${playerXP} XP`;
    
    // Wanted Stars (Max 5)
    let starsHtml = '';
    for(let i=0; i<5; i++) {
        starsHtml += i < Math.min(streak, 5) ? '<span class="active">★</span>' : '☆';
    }
    document.getElementById('wanted-stars').innerHTML = starsHtml;
}

// 5. Audio Engine (Anti-Overlap Micro-Delay)
function playAudio(text) {
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
        utterThis.rate = 1.0; 
        
        synth.speak(utterThis);
    }, 50);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
