let db = []; 
let shuffledIndices = [];
let currentIndex = 0; 
let highestIndexSeen = 0; 
let xpScore = 0; 

// --- SPEECH SYNTHESIS ---
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google'))) || voices.find(v => v.lang === 'en-US');
};

// --- JS AUTO-SCALER ---
function fitText(elementId, maxRem) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let currentRem = maxRem;
    el.style.fontSize = currentRem + 'rem';
    while (el.scrollWidth > el.parentElement.clientWidth && currentRem > 1) {
        currentRem -= 0.15;
        el.style.fontSize = currentRem + 'rem';
    }
}

async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        let storedOrder = localStorage.getItem('aaa_learn_order');
        if (storedOrder) {
            shuffledIndices = JSON.parse(storedOrder);
            if(shuffledIndices.length !== db.length) {
                shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
                localStorage.setItem('aaa_learn_order', JSON.stringify(shuffledIndices));
            }
        } else {
            shuffledIndices = db.map((_, i) => i).sort(() => Math.random() - 0.5);
            localStorage.setItem('aaa_learn_order', JSON.stringify(shuffledIndices));
        }

        if (localStorage.getItem('aaa_highest')) highestIndexSeen = parseInt(localStorage.getItem('aaa_highest'));
        if (localStorage.getItem('aaa_current')) currentIndex = parseInt(localStorage.getItem('aaa_current'));
        if (localStorage.getItem('aaa_xp')) xpScore = parseInt(localStorage.getItem('aaa_xp'));
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR LOADING DATA";
    }
}

// --- SOUND ENGINEERING ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSynthBeep(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

function speakText(text) {
    if (db.length === 0) return;
    synth.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

function playWordAudio() {
    const currentWord = db[shuffledIndices[currentIndex]].w;
    speakText(currentWord);
}

function playSentenceAudio() {
    const currentSentence = db[shuffledIndices[currentIndex]].s;
    speakText(currentSentence);
}

// FLOATING XP PARTICLE EFFECT
function spawnXPPop(amount, btnElement) {
    const rect = btnElement.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'xp-pop';
    popup.innerText = `+${amount} XP`;
    popup.style.left = (rect.left + rect.width / 2) + 'px';
    popup.style.top = rect.top + 'px';
    document.body.appendChild(popup);
    playSynthBeep(1200, 'sine', 0.1, 0.1); 
    setTimeout(() => popup.remove(), 1000); 
}

// --- UI & NAVIGATION ---
function updateXPDisplay() {
    document.getElementById('xp-box').innerText = xpScore.toLocaleString();
}

function updateUI() {
    if (db.length === 0 || currentIndex >= db.length) return;
    const currentData = db[shuffledIndices[currentIndex]];
    
    document.getElementById('word').innerText = currentData.w;
    document.getElementById('definition').innerText = currentData.d;
    
    // DYNAMIC REGEX HIGHLIGHTER: Finds the target word and wraps it in a glowing <span>
    // Using \b ensures we only match whole words, not partial words. 'gi' means global & case-insensitive.
    const regex = new RegExp(`\\b${currentData.w}\\b`, 'gi');
    const highlightedSentence = currentData.s.replace(regex, match => `<span class="highlight-word">${match}</span>`);
    
    // Use innerHTML so the <span> actually renders as HTML instead of plain text
    document.getElementById('sentence').innerHTML = `"${highlightedSentence}"`;
    
    updateXPDisplay();
    fitText('word', 4.5);
    
    document.getElementById('global-progress-fill').style.width = `${(highestIndexSeen / db.length) * 100}%`;

    const backBtn = document.getElementById('back-btn');
    if (currentIndex === 0) {
        backBtn.style.visibility = 'hidden';
    } else {
        backBtn.style.visibility = 'visible';
    }
}

function prevWord() {
    synth.cancel(); 
    if (currentIndex > 0) {
        currentIndex--;
        localStorage.setItem('aaa_current', currentIndex);
        updateUI();
        playWordAudio();
    }
}

function nextWord() {
    synth.cancel(); 
    if (currentIndex < db.length - 1) {
        if (currentIndex === highestIndexSeen) {
            highestIndexSeen++;
            xpScore += 100;
            
            localStorage.setItem('aaa_highest', highestIndexSeen);
            localStorage.setItem('aaa_xp', xpScore);
            
            const nextBtn = document.getElementById('next-btn');
            spawnXPPop(100, nextBtn);
        }
        
        currentIndex++;
        localStorage.setItem('aaa_current', currentIndex);
        updateUI();
        playWordAudio(); 
        
    } else if (currentIndex === db.length - 1) {
        showModal("DATABASE CLEARED", "YOU MASTERED EVERY WORD.", "RESTART", () => {
            currentIndex = 0; highestIndexSeen = 0; xpScore = 0;
            localStorage.setItem('aaa_current', 0);
            localStorage.setItem('aaa_highest', 0);
            localStorage.setItem('aaa_xp', 0);
            updateUI();
        });
    }
}

// --- SWIPE CONTROLS ---
let touchstartX = 0; let touchendX = 0;
document.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    if (!document.getElementById('custom-modal').classList.contains('show')) {
        if (touchendX < touchstartX - 50) nextWord();
        if (touchendX > touchstartX + 50) prevWord();
    }
}, {passive: true});
document.addEventListener('keydown', e => {
    if (!document.getElementById('custom-modal').classList.contains('show')) {
        if (e.key === 'ArrowRight') nextWord();
        if (e.key === 'ArrowLeft') prevWord();
    }
});

// --- MODAL ---
let modalCallback = null;
function showModal(title, desc, buttonText, callback) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    document.querySelector('.modal-btn').innerText = buttonText;
    modalCallback = callback;
    document.getElementById('custom-modal').classList.add('show');
}
function closeModal() {
    document.getElementById('custom-modal').classList.remove('show');
    if (modalCallback) { modalCallback(); modalCallback = null; }
}

initApp();
