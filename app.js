let questions = [];
let currentIndex = 0;
let currentXP = 0;
let levelXP = 500; // XP needed for next level
let currentPotentialXP = 0;
let isDecrypted = false;
let isAnswered = false;

// Initialize App
async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        
        // Parse JSONL
        questions = text.trim().split('\n').map(line => JSON.parse(line));
        
        // Shuffle questions for variety
        questions.sort(() => Math.random() - 0.5);
        
        loadQuestion();
    } catch (error) {
        document.getElementById('question-text').innerText = "ERROR: Connection to mainframe failed. (Make sure you are running a local server to fetch db.jsonl)";
        console.error(error);
    }
}

function loadQuestion() {
    if (currentIndex >= questions.length) {
        document.getElementById('terminal').innerHTML = `<h1 style="color: var(--neon-cyan); text-align:center; font-family: 'Orbitron';">MAINFRAME HACKED<br><br>Final XP: ${currentXP}</h1>`;
        return;
    }

    const q = questions[currentIndex];
    currentPotentialXP = q.base_xp;
    isDecrypted = false;
    isAnswered = false;

    // Reset UI
    document.getElementById('topic-tag').innerText = q.topic.toUpperCase();
    document.getElementById('question-text').innerText = q.en;
    
    const thaiTextEl = document.getElementById('thai-text');
    thaiTextEl.innerText = q.th;
    thaiTextEl.style.display = 'none';

    const decryptBtn = document.getElementById('decrypt-btn');
    decryptBtn.style.display = 'flex';
    decryptBtn.disabled = false;
    decryptBtn.style.opacity = '1';
    document.getElementById('penalty-text').innerText = `Cost: -50% XP (Potential: ${currentPotentialXP})`;

    document.getElementById('next-btn').style.display = 'none';

    // Generate Choices
    const grid = document.getElementById('choices-grid');
    grid.innerHTML = '';
    
    q.choices_en.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `
            <div class="choice-en">${index + 1}. ${choice}</div>
            <div class="choice-th" id="th-choice-${index}">${q.choices_th[index]}</div>
        `;
        btn.onclick = () => submitAnswer(index, btn);
        grid.appendChild(btn);
    });
}

function decryptProtocol() {
    if (isDecrypted || isAnswered) return;
    
    isDecrypted = true;
    
    // Penalize XP (cut in half)
    currentPotentialXP = Math.floor(currentPotentialXP * 0.5);
    
    // UI Updates
    document.getElementById('thai-text').style.display = 'block';
    
    // Show Thai choices
    const thChoices = document.querySelectorAll('.choice-th');
    thChoices.forEach(el => el.style.display = 'block');

    // Update Button
    const decryptBtn = document.getElementById('decrypt-btn');
    decryptBtn.disabled = true;
    decryptBtn.style.opacity = '0.5';
    document.getElementById('penalty-text').innerText = `Decrypted. Potential XP: ${currentPotentialXP}`;
}

function submitAnswer(selectedIndex, btnElement) {
    if (isAnswered) return;
    isAnswered = true;

    const q = questions[currentIndex];
    const allBtns = document.querySelectorAll('.choice-btn');
    
    // Disable all buttons
    allBtns.forEach(btn => btn.style.pointerEvents = 'none');

    // Check Answer
    if (selectedIndex === q.correct_index) {
        btnElement.classList.add('correct');
        addXP(currentPotentialXP);
    } else {
        btnElement.classList.add('wrong');
        // Highlight correct answer
        allBtns[q.correct_index].classList.add('correct');
    }

    document.getElementById('decrypt-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'block';
}

function addXP(amount) {
    currentXP += amount;
    
    // Update HUD
    document.getElementById('xp-display').innerText = `${currentXP} XP`;
    
    let progress = (currentXP / levelXP) * 100;
    if (progress >= 100) progress = 100; // Cap at 100 for MVP
    
    document.getElementById('xp-bar').style.width = `${progress}%`;
}

function nextQuestion() {
    currentIndex++;
    loadQuestion();
}

// Boot up
window.onload = initApp;
