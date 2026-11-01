let currentDb = []; 
let currentIndex = 0; 
let activeLetter = 'a'; // Default starting letter

// --- SPEECH SYNTHESIS ---
const synth = window.speechSynthesis;
let americanVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google'))) 
                    || voices.find(v => v.lang === 'en-US');
};

// --- INITIALIZATION ---
async function initApp() {
    buildLetterNav();
    await loadLetterDb(activeLetter);
}

// Generate A-Z buttons dynamically
function buildLetterNav() {
    const nav = document.getElementById('letter-nav');
    nav.innerHTML = '';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    
    alphabet.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = `letter-btn ${letter === activeLetter ? 'active' : ''}`;
        btn.innerText = letter.toUpperCase();
        btn.onclick = () => switchLetter(letter);
        nav.appendChild(btn);
    });
}

// Fetch the specific JSONL file from the /db folder
async function loadLetterDb(letter) {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('error-screen').style.display = 'none';
    
    try {
        const response = await fetch(`db/${letter}.jsonl`);
        if (!response.ok) throw new Error("File not found");
        
        const text = await response.text();
        currentDb = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        // Reset index for new letter
        currentIndex = 0;
        
        // Update Slider limits
        const slider = document.getElementById('word-slider');
        slider.max = currentDb.length - 1;
        slider.value = 0;
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('error-screen').innerHTML = `DATABASE FOR '${letter.toUpperCase()}' NOT FOUND.<br><span style="font-size: 1rem; color: #64748b; margin-top: 10px;">Please create db/${letter}.jsonl</span>`;
        currentDb = [];
    }
}

// Handle switching letters
async function switchLetter(letter) {
    if (letter === activeLetter) return;
    synth.cancel();
    
    activeLetter = letter;
    buildLetterNav(); // Update active class
    
    // Scroll the clicked letter into view smoothly
    const activeBtn = document.querySelector('.letter-btn.active');
    if(activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    
    await loadLetterDb(letter);
}

// --- AUDIO ENGINE ---
function speakText(text) {
    if (currentDb.length === 0) return;
    synth.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    if (americanVoice) utterance.voice = americanVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

function playWordAudio() {
    if(currentDb.length === 0) return;
    const currentData = currentDb[currentIndex];
    // Uses the "tts" field from DB if it exists (for heteronyms), otherwise reads the normal word
    const textToSpeak = currentData.tts || currentData.w;
    speakText(textToSpeak);
}

// --- UI & SCRUBBER CONTROL ---
function updateUI() {
    if (currentDb.length === 0) return;
    const currentData = currentDb[currentIndex];
    
    document.getElementById('word').innerText = currentData.w;
    document.getElementById('ipa').innerText = currentData.i;
    document.getElementById('definition').innerText = currentData.d;
    
    // Update the counter text above the slider
    document.getElementById('word-count-display').innerText = `${currentIndex + 1} / ${currentDb.length}`;
}

// Fired rapidly as the user drags the slider
function scrubWord() {
    const slider = document.getElementById('word-slider');
    currentIndex = parseInt(slider.value);
    synth.cancel(); // Stop audio immediately if scrubbing fast
    updateUI();
}

// Automatically play audio when user releases the slider
document.getElementById('word-slider').addEventListener('change', () => {
    playWordAudio();
});

// Auto-scale huge words
window.addEventListener('resize', () => {
    const wordEl = document.getElementById('word');
    if(wordEl && wordEl.scrollWidth > wordEl.parentElement.clientWidth) {
        wordEl.style.fontSize = '2.5rem';
    } else {
        wordEl.style.fontSize = '3.5rem';
    }
});

initApp();
