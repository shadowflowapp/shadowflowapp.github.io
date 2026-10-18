let wordData = null;
let currentIndex = 0;

// Initialize Web Speech API for Audio
const synth = window.speechSynthesis;

fetch('db.json')
    .then(response => response.json())
    .then(data => {
        wordData = data;
        document.getElementById('target-word').innerText = wordData.target_word;
        document.getElementById('phonetic').innerText = wordData.phonetic;
        document.getElementById('total-index').innerText = wordData.total_sentences;
        
        renderSentence(currentIndex);
    })
    .catch(err => console.error("Error loading DB", err));

function renderSentence(index) {
    const data = wordData.sentences[index];
    document.getElementById('current-index').innerText = index + 1;
    
    document.getElementById('situation-tag').innerText = data.situation;
    document.getElementById('pos-tag').innerText = data.pos;
    
    // Highlight the target word in the sentence
    const regex = new RegExp(`(${wordData.target_word}[a-z]*)`, 'gi');
    const highlightedSentence = data.en.replace(regex, `<span class="target-highlight">$1</span>`);
    document.getElementById('english-sentence').innerHTML = highlightedSentence;
    
    // Reset Thai Bridge
    document.getElementById('reveal-btn').style.display = 'inline-block';
    const thaiText = document.getElementById('thai-text');
    thaiText.style.display = 'none';
    thaiText.innerText = data.th;
}

function revealThai() {
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('thai-text').style.display = 'block';
}

function nextSentence() {
    if (currentIndex < wordData.total_sentences - 1) {
        currentIndex++;
        renderSentence(currentIndex);
    } else {
        alert("You've mastered all contexts for this word! Ready for the Context Quiz?");
        // Here you would transition them to the Active gamification testing phase
        currentIndex = 0; 
        renderSentence(currentIndex);
    }
}

// Built-in free Text-to-Speech (US English)
function playAudio() {
    if (synth.speaking) {
        synth.cancel(); // stop current audio if playing
    }
    const textToSpeak = wordData.sentences[currentIndex].en;
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    
    // Try to set voice to US English
    const voices = synth.getVoices();
    const usVoice = voices.find(voice => voice.lang === 'en-US');
    if (usVoice) utterThis.voice = usVoice;
    
    utterThis.rate = 0.9; // Slightly slower for language learners
    synth.speak(utterThis);
}

// Load voices async (Browser quirk)
speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };
