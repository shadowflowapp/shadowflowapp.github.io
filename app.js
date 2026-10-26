let words = [];
let currentIndex = 0;
let learnedWords = new Set(); 

const wordDisplay = document.getElementById('word-display');
const posDisplay = document.getElementById('pos-display');
const meaningDisplay = document.getElementById('meaning-display');
const audioBtn = document.getElementById('audio-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const learnedCount = document.getElementById('learned-count');

// --- Web Speech API (Text-to-Speech) Setup ---
const synth = window.speechSynthesis;
let usMaleVoice = null;

function loadVoice() {
    const voices = synth.getVoices();
    // Prioritize US English and filter by common male voice names 
    usMaleVoice = voices.find(v => 
        v.lang === 'en-US' && 
        (v.name.toLowerCase().includes('male') || 
         v.name.toLowerCase().includes('david') ||
         v.name.toLowerCase().includes('guy') ||
         v.name.toLowerCase().includes('aaron'))
    );
    // Fallback: If no explicit male voice is found, just grab any en-US voice
    if (!usMaleVoice) {
        usMaleVoice = voices.find(v => v.lang === 'en-US');
    }
}

// Voices load asynchronously in some browsers
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoice;
}

// --- App Initialization ---
async function init() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        
        // Efficiently parse JSONL
        words = text.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => JSON.parse(line));
        
        if (words.length > 0) {
            // Restore session progress if available
            const savedIndex = localStorage.getItem('currentWordIndex');
            const savedLearnedCount = localStorage.getItem('learnedWordsCount');
            
            if (savedIndex !== null) currentIndex = parseInt(savedIndex);
            
            // Reconstruct the Set count for MVP tracking
            if (savedLearnedCount !== null) {
                let count = parseInt(savedLearnedCount);
                for(let i = 0; i < count; i++) learnedWords.add(i);
            }
            
            updateUI();
        } else {
            wordDisplay.textContent = "Error: Database empty";
        }
    } catch (error) {
        console.error('Error loading database:', error);
        wordDisplay.textContent = "Failed to load words.";
    }
}

// --- UI Updates ---
function updateUI() {
    const currentData = words[currentIndex];
    wordDisplay.textContent = currentData.w;
    posDisplay.textContent = currentData.p;
    meaningDisplay.textContent = currentData.t;

    // Track unique words learned
    learnedWords.add(currentIndex);
    learnedCount.textContent = learnedWords.size.toLocaleString();
    
    // Persist progress to local storage
    localStorage.setItem('currentWordIndex', currentIndex);
    localStorage.setItem('learnedWordsCount', learnedWords.size);

    // Update navigation states
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === words.length - 1;
}

// --- Audio Playback ---
function playAudio() {
    if (!words[currentIndex]) return;
    
    // Stop any currently playing audio before starting the next
    synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(words[currentIndex].w);
    utterance.lang = 'en-US';
    
    if (usMaleVoice) {
        utterance.voice = usMaleVoice;
    }
    
    utterance.rate = 0.85; // Slightly slowed down for learner clarity
    utterance.pitch = 1.0;
    
    synth.speak(utterance);
}

// --- Event Listeners ---
nextBtn.addEventListener('click', () => {
    if (currentIndex < words.length - 1) {
        currentIndex++;
        updateUI();
    }
});

prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        updateUI();
    }
});

audioBtn.addEventListener('click', playAudio);

// Boot the app
init();
