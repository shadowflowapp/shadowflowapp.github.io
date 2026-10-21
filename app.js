let database = [];
const synth = window.speechSynthesis;

// Progress Metrics
let viewedSentences = new Set();
let masteredStructures = new Set();

// State
let currentPatternIndex = 0;
let currentExampleIndex = 0;
let currentPatternData = null;

// Touch Swipe Handling
let touchstartX = 0;
let touchendX = 0;

// 1. Initialize
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        loadPattern(0);
        setupSwipeListeners();
    })
    .catch(err => console.error("Error loading DB", err));

// 2. Load a New Pattern
function loadPattern(index) {
    if (index >= database.length) {
        alert("Incredible! You have mastered all available structures.");
        index = 0; // Loop for MVP
    }
    
    currentPatternIndex = index;
    currentPatternData = database[index];
    currentExampleIndex = 0;

    document.getElementById('pattern-title').innerText = currentPatternData.patternName;
    document.getElementById('template-hint').innerText = `Pattern: ${currentPatternData.template}`;
    
    // Reset Next Pattern button state
    const nextPatBtn = document.getElementById('btn-next-pattern');
    nextPatBtn.classList.remove('active');
    nextPatBtn.innerText = "Complete All Examples First";

    renderExample();
}

// 3. Render the specific sentence card
function renderExample() {
    const example = currentPatternData.examples[currentExampleIndex];
    
    // Record Metrics
    viewedSentences.add(example.en);
    updateMetricsHUD();

    // Dynamically highlight the injected word
    // We replace the specific word with a styled span
    const safeWord = example.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeWord})`, 'i');
    const highlightedEn = example.en.replace(regex, `<span class="highlight-blank">$1</span>`);

    // UI Updates
    document.getElementById('english-sentence').innerHTML = highlightedEn;
    document.getElementById('thai-translation').innerText = example.th;

    // Controls Update
    document.getElementById('btn-prev').disabled = currentExampleIndex === 0;
    document.getElementById('btn-next').disabled = currentExampleIndex === currentPatternData.examples.length - 1;

    renderPagination();
    checkPatternCompletion();
}

// 4. Navigation
function prevExample() {
    if (currentExampleIndex > 0) {
        currentExampleIndex--;
        animateCard('left');
        renderExample();
    }
}

function nextExample() {
    if (currentExampleIndex < currentPatternData.examples.length - 1) {
        currentExampleIndex++;
        animateCard('right');
        renderExample();
    }
}

function loadNextPattern() {
    masteredStructures.add(currentPatternData.id);
    updateMetricsHUD();
    loadPattern(currentPatternIndex + 1);
}

// 5. Check Completion
function checkPatternCompletion() {
    // If they reached the last card of the pattern
    if (currentExampleIndex === currentPatternData.examples.length - 1) {
        const nextPatBtn = document.getElementById('btn-next-pattern');
        nextPatBtn.classList.add('active');
        nextPatBtn.innerText = "Next Structure ➔";
    }
}

// 6. Pagination & Animations
function renderPagination() {
    const pagContainer = document.getElementById('pagination');
    pagContainer.innerHTML = '';
    for (let i = 0; i < currentPatternData.examples.length; i++) {
        const dot = document.createElement('div');
        dot.className = `dot ${i === currentExampleIndex ? 'active' : ''}`;
        pagContainer.appendChild(dot);
    }
}

function animateCard(direction) {
    const card = document.getElementById('flashcard');
    card.style.transform = direction === 'right' ? 'translateX(20px)' : 'translateX(-20px)';
    card.style.opacity = '0.5';
    setTimeout(() => {
        card.style.transform = 'translateX(0)';
        card.style.opacity = '1';
    }, 150);
}

// 7. Metrics HUD Update
function updateMetricsHUD() {
    document.getElementById('metric-sentences').innerText = viewedSentences.size;
    document.getElementById('metric-structures').innerText = masteredStructures.size;
}

// 8. Swipe Listeners for Mobile
function setupSwipeListeners() {
    const card = document.getElementById('flashcard');
    card.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    });
    card.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    });
}

function handleSwipe() {
    const threshold = 50;
    if (touchstartX - touchendX > threshold) nextExample(); // Swipe Left
    if (touchendX - touchstartX > threshold) prevExample(); // Swipe Right
}

// 9. Audio Engine (Anti-Overlap)
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    setTimeout(() => {
        const textToSpeak = currentPatternData.examples[currentExampleIndex].en;
        const utterThis = new SpeechSynthesisUtterance(textToSpeak);
        const voices = synth.getVoices();
        
        const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
        let selectedVoice = voices.find(v => 
            v.lang.includes('en-US') && maleUSIdentifiers.some(id => v.name.includes(id))
        );
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));

        if (selectedVoice) utterThis.voice = selectedVoice;
        utterThis.rate = 0.95; // Slightly clear pacing
        
        synth.speak(utterThis);
    }, 50);
}

speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
