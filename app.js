let bubbles = {};
let currentBubble = '';
let bubbleKeys = [];
let currentIndex = 0;

let stats = {
    sentencesLearned: parseInt(localStorage.getItem('sentencesLearned')) || 0,
    bubblesLearned: parseInt(localStorage.getItem('bubblesLearned')) || 0
};

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
const autoplayToggle = document.getElementById('autoplay-toggle');

autoplayToggle.checked = localStorage.getItem('autoplayEnabled') !== 'false';
autoplayToggle.addEventListener('change', () => {
    localStorage.setItem('autoplayEnabled', autoplayToggle.checked);
});

function updateStatsDisplay() {
    statSentences.textContent = stats.sentencesLearned;
    statBubbles.textContent = stats.bubblesLearned;
}

async function loadDatabase() {
    try {
        const response = await fetch('db.jsonl');
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const text = await response.text();
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        lines.forEach(line => {
            const entry = JSON.parse(line);
            if (!bubbles[entry.bubble]) bubbles[entry.bubble] = [];
            bubbles[entry.bubble].push(entry);
        });

        bubbleKeys = Object.keys(bubbles);
        if (bubbleKeys.length > 0) {
            cardContainer.style.display = 'flex';
            loadRandomBubble();
        } else {
            enText.textContent = "DATABASE EMPTY.";
        }
    } catch (error) {
        console.error("Failed to load db.jsonl:", error);
        enText.textContent = "DATABASE ERROR.";
        thText.textContent = "Requires local server for CORS.";
    }
}

function loadRandomBubble() {
    const randomIndex = Math.floor(Math.random() * bubbleKeys.length);
    currentBubble = bubbleKeys[randomIndex];
    currentIndex = 0;
    updateUI(false); 
}

function updateUI(triggerAutoplay = true) {
    const currentData = bubbles[currentBubble][currentIndex];
    const totalInBubble = bubbles[currentBubble].length;
    
    bubbleName.textContent = `"${currentBubble}"`;
    progressIndicator.textContent = `${currentIndex + 1} / ${totalInBubble}`;
    
    const formattedEn = currentData.en.replace(/\/(.*?)\//g, '<span class="highlight">$1</span>');
    enText.innerHTML = formattedEn;
    thText.textContent = currentData.th;

    btnPrev.disabled = currentIndex === 0;
    completionMsg.style.display = 'none';
    btnNext.textContent = currentIndex === totalInBubble - 1 ? 'FINISH' : 'NEXT';

    if (triggerAutoplay && autoplayToggle.checked) {
        setTimeout(() => btnPlay.click(), 100); 
    }
}

function playAudio(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); 
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95; 
    utterance.pitch = 0.9; 
    
    const voices = window.speechSynthesis.getVoices();
    const maleNames = ['david', 'guy', 'mark', 'andrew', 'aaron', 'us english male', 'en-us-wavenet-d', 'en-us-wavenet-j'];
    
    let maleVoice = voices.find(v => 
        (v.lang === 'en-US' || v.lang === 'en_US') && 
        maleNames.some(name => v.name.toLowerCase().includes(name))
    );
    
    if (!maleVoice) maleVoice = voices.find(v => (v.lang === 'en-US' || v.lang === 'en_US') && v.name.toLowerCase().includes('male'));
    if (!maleVoice) maleVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en_US');

    if (maleVoice) utterance.voice = maleVoice;
    window.speechSynthesis.speak(utterance);
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {};
}

btnPlay.addEventListener('click', () => {
    const plainTextEn = bubbles[currentBubble][currentIndex].en.replace(/\//g, '');
    playAudio(plainTextEn);
});

function goNext() {
    if (completionMsg.style.display === 'block') return; 
    
    stats.sentencesLearned++;
    localStorage.setItem('sentencesLearned', stats.sentencesLearned);
    updateStatsDisplay();

    const totalInBubble = bubbles[currentBubble].length;

    if (currentIndex < totalInBubble - 1) {
        currentIndex++;
        updateUI(true);
    } else {
        stats.bubblesLearned++;
        localStorage.setItem('bubblesLearned', stats.bubblesLearned);
        updateStatsDisplay();
        
        completionMsg.style.display = 'block';
        setTimeout(() => loadRandomBubble(), 1500);
    }
}

function goPrev() {
    if (currentIndex > 0) {
        currentIndex--;
        updateUI(true);
    }
}

btnNext.addEventListener('click', goNext);
btnPrev.addEventListener('click', goPrev);

let startX = 0;
let endX = 0;
const swipeThreshold = 60; 
let isDragging = false;

cardContainer.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].screenX;
}, {passive: true});

cardContainer.addEventListener('touchend', e => {
    endX = e.changedTouches[0].screenX;
    handleSwipe();
}, {passive: true});

cardContainer.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.screenX;
});

window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    endX = e.screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistance = startX - endX;
    if (swipeDistance > swipeThreshold) {
        goNext();
    } else if (swipeDistance < -swipeThreshold) {
        goPrev();
    }
}

updateStatsDisplay();
loadDatabase();
