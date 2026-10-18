let database = [];
let currentWordIndex = 0;
let currentSentenceIndex = 0;

// Initialize Web Speech API
const synth = window.speechSynthesis;

// 1. Fetch and Parse JSONL
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        // Split by newlines and filter out any empty strings
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        document.getElementById('total-words').innerText = database.length;
        loadWordHub(currentWordIndex);
    })
    .catch(err => console.error("Error loading JSONL DB", err));

// 2. Load Word Hub Data
function loadWordHub(wordIdx) {
    const wordData = database[wordIdx];
    document.getElementById('word-index').innerText = wordIdx + 1;
    document.getElementById('target-word').innerText = wordData.target_word;
    document.getElementById('phonetic').innerText = wordData.phonetic;
    document.getElementById('total-index').innerText = wordData.sentences.length;
    
    currentSentenceIndex = 0;
    renderSentence(currentSentenceIndex);
}

// 3. Render Sentence Card
function renderSentence(sentenceIdx) {
    const wordData = database[currentWordIndex];
    const data = wordData.sentences[sentenceIdx];
    
    document.getElementById('current-index').innerText = sentenceIdx + 1;
    document.getElementById('situation-tag').innerText = data.situation;
    document.getElementById('pos-tag').innerText = data.pos;
    
    // Highlight target word (case insensitive matching)
    const regex = new RegExp(`(${wordData.target_word}[a-z]*)`, 'gi');
    const highlightedSentence = data.en.replace(regex, `<span class="target-highlight">$1</span>`);
    document.getElementById('english-sentence').innerHTML = highlightedSentence;
    
    // Reset Thai Bridge UI
    document.getElementById('reveal-btn').style.display = 'inline-block';
    const thaiText = document.getElementById('thai-text');
    thaiText.style.display = 'none';
    thaiText.innerText = data.th;
}

// 4. Interaction Functions
function revealThai() {
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('thai-text').style.display = 'block';
}

function nextSentence() {
    const wordData = database[currentWordIndex];
    
    if (currentSentenceIndex < wordData.sentences.length - 1) {
        // Move to next sentence in current word hub
        currentSentenceIndex++;
        renderSentence(currentSentenceIndex);
    } else {
        // Word hub completed, move to next word
        if (currentWordIndex < database.length - 1) {
            currentWordIndex++;
            loadWordHub(currentWordIndex);
        } else {
            alert("You have completed the entire database!");
            currentWordIndex = 0;
            loadWordHub(currentWordIndex);
        }
    }
}

// 5. Native Text-to-Speech (Targeting American Male Voice)
function playAudio() {
    if (synth.speaking) synth.cancel(); 
    
    const wordData = database[currentWordIndex];
    const textToSpeak = wordData.sentences[currentSentenceIndex].en;
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    // Attempt to locate an American Male voice
    const voices = synth.getVoices();
    
    // Common American male voice identifiers across Windows, macOS, Android, and Chrome
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    
    let selectedVoice = voices.find(voice => 
        voice.lang.includes('en-US') && 
        maleUSIdentifiers.some(identifier => voice.name.includes(identifier))
    );

    // Fallback: If no specific male name is found, take the first en-US voice
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.includes('en-US'));
    }

    if (selectedVoice) {
        utterThis.voice = selectedVoice;
    }
    
    utterThis.rate = 0.95; // Slightly slower pacing for learners
    synth.speak(utterThis);
}

// Browser quirk: ensure voices load fully before first play
speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
