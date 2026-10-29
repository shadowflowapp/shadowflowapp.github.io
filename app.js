let db = []; 
let currentIndex = 0; 
let highestIndexSeen = 0; 

// --- SPEECH SYNTHESIS ---
const synth = window.speechSynthesis;
let americanVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    // Prioritize natural US voices
    americanVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google'))) 
                    || voices.find(v => v.lang === 'en-US');
};

// --- HETERONYM PRONUNCIATION ENGINE ---
// Browser TTS cannot read IPA. If a word has two pronunciations, we feed it a phonetic spelling instead.
function getPhoneticSpelling(word, pos) {
    const wordLower = word.toLowerCase();
    const heteronyms = {
        "tear": { "v.": "tare", "n.": "teer" },
        "lead": { "v.": "leed", "n.": "led" },
        "bow": { "v.": "baow", "n.": "boh" },
        "wind": { "v.": "wynd", "n.": "wind" },
        "minute": { "n.": "min-it", "adj.": "my-noot" },
        "record": { "v.": "ri-cord", "n.": "rec-ord" },
        "live": { "v.": "liv", "adj.": "lyv" },
        "close": { "v.": "cloze", "adj.": "clohs" },
        "use": { "v.": "yuze", "n.": "yoos" }
    };
    
    if (heteronyms[wordLower] && heteronyms[wordLower][pos]) {
        return heteronyms[wordLower][pos];
    }
    return word; // Default: just read the word normally
}

// --- JS AUTO-SCALER ---
function fitText(elementId, maxRem) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let currentRem = maxRem;
    el.style.fontSize = currentRem + 'rem';
    while (el.scrollWidth > el.parentElement.clientWidth && currentRem > 1) {
        currentRem -= 0.1;
        el.style.fontSize = currentRem + 'rem';
    }
}

async function initApp() {
    try {
        const response = await fetch('db.jsonl');
        const text = await response.text();
        // A-to-Z Loading
        db = text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        
        document.getElementById('total-count').innerText = db.length;

        // Load progression data
        if (localStorage.getItem('la_highest')) highestIndexSeen = parseInt(localStorage.getItem('la_highest'));
        if (localStorage.getItem('la_current')) currentIndex = parseInt(localStorage.getItem('la_current'));
        
        document.getElementById('loading-screen').style.display = 'none';
        updateUI();
    } catch (error) {
        document.getElementById('loading-screen').innerText = "ERROR LOADING DATA";
    }
}

function speakText(text) {
    if (db.length === 0) return;
    synth.cancel(); // STRICT CANCEL to prevent overlapping
    const utterance = new SpeechSynthesisUtterance(text);
    if (americanVoice) utterance.voice = americanVoice;
    utterance.rate = 0.85; 
    synth.speak(utterance);
}

function playWordAudio() {
    const currentData = db[currentIndex];
    // Use the phonetic spelling engine for the isolated word
    const textToSpeak = getPhoneticSpelling(currentData.w, currentData.p);
    speakText(textToSpeak);
}

function playSentenceAudio() {
    const currentSentence = db[currentIndex].s;
    speakText(currentSentence);
}

// --- UI & NAVIGATION ---
function updateUI() {
    if (db.length === 0 || currentIndex >= db.length) return;
    const currentData = db[currentIndex];
    
    document.getElementById('word').innerText = currentData.w;
    document.getElementById('ipa').innerText = currentData.i;
    document.getElementById('definition').innerText = currentData.d;
    
    // DYNAMIC REGEX HIGHLIGHTER
    // Preserves exact original capitalization of the target word in the sentence
    const regex = new RegExp(`\\b${currentData.w}\\b`, 'gi');
    const highlightedSentence = currentData.s.replace(regex, match => `<span class="highlight-word">${match}</span>`);
    
    document.getElementById('sentence').innerHTML = `"${highlightedSentence}"`;
    
    fitText('word', 3.5);
    
    // Update Learned Count
    // Learned count is the highest index they have seen + 1
    const displayCount = Math.max(currentIndex + 1, highestIndexSeen + 1);
    document.getElementById('learned-count').innerText = displayCount;
    document.getElementById('progress-bar-fill').style.width = `${(displayCount / db.length) * 100}%`;

    // Hide PREV button on the first word
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
        localStorage.setItem('la_current', currentIndex);
        updateUI();
        playWordAudio();
    }
}

function nextWord() {
    synth.cancel(); 
    if (currentIndex < db.length - 1) {
        if (currentIndex === highestIndexSeen) {
            highestIndexSeen++;
            localStorage.setItem('la_highest', highestIndexSeen);
        }
        
        currentIndex++;
        localStorage.setItem('la_current', currentIndex);
        updateUI();
        playWordAudio(); 
        
    } else if (currentIndex === db.length - 1) {
        // End of Database
        showModal("DICTIONARY COMPLETED", "You have successfully reviewed all entries.", "RESTART", () => {
            currentIndex = 0; highestIndexSeen = 0;
            localStorage.setItem('la_current', 0);
            localStorage.setItem('la_highest', 0);
            updateUI();
        });
    }
}

// --- SWIPE & KEYBOARD CONTROLS ---
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
