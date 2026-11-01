let currentDb = []; 
let currentIndex = 0; 
let activeLetter = 'a'; 

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

async function loadLetterDb(letter) {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('error-screen').style.display = 'none';
    
    try {
        const response = await fetch(`db/${letter}.jsonl`);
        if (!response.ok) throw new Error("File not found");
        
        const text = await response.text();
        currentDb = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        currentIndex = 0;
        
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

async function switchLetter(letter) {
    if (letter === activeLetter) return;
    synth.cancel();
    
    activeLetter = letter;
    buildLetterNav();
    
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
    const textToSpeak = currentData.tts || currentData.w;
    speakText(textToSpeak);
}

// --- UI & NAVIGATION ---
function updateUI() {
    if (currentDb.length === 0) return;
    const currentData = currentDb[currentIndex];
    
    document.getElementById('word').innerText = currentData.w;
    document.getElementById('ipa').innerText = currentData.i;
    document.getElementById('definition').innerText = currentData.d;
    
    // Sync UI elements
    document.getElementById('word-slider').value = currentIndex;
    document.getElementById('word-count-display').innerText = `${currentIndex + 1} / ${currentDb.length}`;

    // Toggle Back button visibility
    document.getElementById('back-btn').style.visibility = (currentIndex === 0) ? 'hidden' : 'visible';
}

// Slider Drag
function scrubWord() {
    const slider = document.getElementById('word-slider');
    currentIndex = parseInt(slider.value);
    synth.cancel(); 
    updateUI();
}

// Slider Release (Auto-play audio)
document.getElementById('word-slider').addEventListener('change', () => {
    playWordAudio();
});

// Button Controls
function prevWord() {
    if (currentDb.length === 0) return;
    synth.cancel();
    if (currentIndex > 0) {
        currentIndex--;
        updateUI();
        playWordAudio();
    }
}

function nextWord() {
    if (currentDb.length === 0) return;
    synth.cancel();
    if (currentIndex < currentDb.length - 1) {
        currentIndex++;
        updateUI();
        playWordAudio();
    }
}

// --- MOBILE SWIPE GESTURES ---
let touchstartX = 0; 
let touchendX = 0;
let touchstartY = 0;
let touchendY = 0;

document.addEventListener('touchstart', e => { 
    touchstartX = e.changedTouches[0].screenX; 
    touchstartY = e.changedTouches[0].screenY; 
}, {passive: true});

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    touchendY = e.changedTouches[0].screenY;
    
    // Ensure the user is swiping horizontally, not scrolling vertically
    const deltaX = touchendX - touchstartX;
    const deltaY = touchendY - touchstartY;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) nextWord(); // Swipe Left -> Next
        if (deltaX > 0) prevWord(); // Swipe Right -> Prev
    }
}, {passive: true});

// --- KEYBOARD CONTROLS ---
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') nextWord();
    if (e.key === 'ArrowLeft') prevWord();
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
