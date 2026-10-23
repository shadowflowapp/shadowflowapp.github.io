let bubbles = {};
let currentBubble = '';
let bubbleKeys = [];
let currentIndex = 0;

// Load user progress from localStorage
let stats = {
    sentencesLearned: parseInt(localStorage.getItem('sentencesLearned')) || 0,
    bubblesLearned: parseInt(localStorage.getItem('bubblesLearned')) || 0
};

// UI Elements
const enText = document.getElementById('en-text');
const thText = document.getElementById('th-text');
const bubbleName = document.getElementById('bubble-name');
const progressIndicator = document.getElementById('progress-indicator');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnPlay = document.getElementById('btn-play');
const statSentences = document.getElementById('stat-sentences');
const statBubbles = document.getElementById('stat-bubbles');
const completionMsg = document.getElementById('completion-msg');
const cardContainer = document.getElementById('card-container');

function updateStatsDisplay() {
    statSentences.textContent = stats.sentencesLearned;
    statBubbles.textContent = stats.bubblesLearned;
}

// Fetch and parse db.jsonl
async function loadDatabase() {
    try {
        const response = await fetch('db.jsonl');
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const text = await response.text();
        
        // Parse JSON Lines
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach(line => {
            const entry = JSON.parse(line);
            if (!bubbles[entry.bubble]) {
                bubbles[entry.bubble] = [];
            }
            bubbles[entry.bubble].push(entry);
        });

        bubbleKeys = Object.keys(bubbles);
        if (bubbleKeys.length > 0) {
            cardContainer.style.display = 'block';
            loadRandomBubble();
        } else {
            enText.textContent = "Database is empty.";
            thText.textContent = "";
        }
    } catch (error) {
        console.error("Failed to load db.jsonl:", error);
        enText.textContent = "Error loading database.";
        thText.textContent = "Please run this app using a local web server (e.g., Live Server).";
    }
}

function loadRandomBubble() {
    const randomIndex = Math.floor(Math.random() * bubbleKeys.length);
    currentBubble = bubbleKeys[randomIndex];
    currentIndex = 0;
    updateUI();
}

function updateUI() {
    const currentData = bubbles[currentBubble][currentIndex];
    const totalInBubble = bubbles[currentBubble].length;
    
    bubbleName.textContent = `"${currentBubble}"`;
    progressIndicator.textContent = `${currentIndex + 1} / ${totalInBubble}`;
    
    // Parse the /target/ syntax into a styled HTML span
    const formattedEn = currentData.en.replace(/\/(.*?)\//g, '<span class="highlight">$1</span>');
    enText.innerHTML = formattedEn;
    
    thText.textContent = currentData.th;

    btnPrev.disabled = currentIndex === 0;
    completionMsg.style.display = 'none';
    btnNext.textContent = currentIndex === totalInBubble - 1 ? 'Finish' : 'Next';
}

function playAudio(text) {
    if (!window.speechSynthesis) {
        alert("Your browser does not support text-to-speech.");
        return;
    }
    
    window.speechSynthesis.cancel(); 
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; 
    
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v => 
        (v.lang === 'en-US' || v.lang === 'en_US') && 
        (v.name.toLowerCase().includes('david') || 
         v.name.toLowerCase().includes('male') || 
         v.name.toLowerCase().includes('guy'))
    );
    
    if (maleVoice) {
        utterance.voice = maleVoice;
    } else {
        const fallback = voices.find(v => v.lang === 'en-US');
        if (fallback) utterance.voice = fallback;
    }

    window.speechSynthesis.speak(utterance);
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {};
}

btnPlay.addEventListener('click', () => {
    // Strip the '/' characters so the TTS engine reads it normally
    const plainTextEn = bubbles[currentBubble][currentIndex].en.replace(/\//g, '');
    playAudio(plainTextEn);
});

btnNext.addEventListener('click', () => {
    stats.sentencesLearned++;
    localStorage.setItem('sentencesLearned', stats.sentencesLearned);
    updateStatsDisplay();

    const totalInBubble = bubbles[currentBubble].length;

    if (currentIndex < totalInBubble - 1) {
        currentIndex++;
        updateUI();
    } else {
        stats.bubblesLearned++;
        localStorage.setItem('bubblesLearned', stats.bubblesLearned);
        updateStatsDisplay();
        
        completionMsg.style.display = 'block';
        setTimeout(() => {
            loadRandomBubble();
        }, 1500);
    }
});

btnPrev.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        updateUI();
    }
});

updateStatsDisplay();
loadDatabase();
