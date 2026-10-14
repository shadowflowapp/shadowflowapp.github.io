let database = [];
let currentSentenceId = null;
let streak = 0;
let lastClickedWord = "";

// Hashing function to give every unique word a consistent, beautiful color
function getWordColor(word) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
        hash = word.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Convert to a pastel/neon HSL color suitable for dark mode (High saturation, high lightness)
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 85%, 75%)`; 
}

// 1. Fetch the JSON database
fetch('db.json')
    .then(response => response.json())
    .then(data => {
        database = data;
        loadRandomSentence();
    })
    .catch(error => console.error('Error loading DB:', error));

// 2. Clean word helper
function cleanWordForSearch(word) {
    return word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();
}

// 3. Render the sentence and apply UI effects
function renderSentence(sentenceObj) {
    const contentArea = document.getElementById('content-area');
    
    // Fade out effect
    contentArea.style.opacity = 0;

    setTimeout(() => {
        currentSentenceId = sentenceObj.id;
        const englishContainer = document.getElementById('english-sentence');
        const thaiContainer = document.getElementById('thai-translation');
        
        englishContainer.innerHTML = ''; 
        thaiContainer.textContent = sentenceObj.th;

        // Split sentence into words
        const words = sentenceObj.en.split(' ');

        words.forEach(word => {
            const cleanWord = cleanWordForSearch(word);
            const span = document.createElement('span');
            
            span.textContent = word;
            span.className = 'clickable-word';
            span.style.color = getWordColor(cleanWord);
            
            // Check if this is the word the user just clicked to get here
            if (lastClickedWord && cleanWord === lastClickedWord) {
                span.classList.add('highlighted-match');
            }
            
            span.onclick = () => handleWordClick(cleanWord);
            englishContainer.appendChild(span);
        });

        // Fade in effect
        contentArea.style.opacity = 1;
    }, 300); // Wait for fade out to complete
}

// 4. Handle the click mechanic
function handleWordClick(clickedWord) {
    lastClickedWord = clickedWord;

    const matches = database.filter(item => {
        if (item.id === currentSentenceId) return false;
        
        // Exact word boundary match
        const regex = new RegExp(`\\b${clickedWord}\\b`, 'i');
        return regex.test(item.en);
    });

    if (matches.length > 0) {
        const nextSentence = matches[Math.floor(Math.random() * matches.length)];
        updateStreak();
        renderSentence(nextSentence);
    } else {
        showToast(`No other sentences with "${clickedWord}"`);
        lastClickedWord = ""; // reset so nothing highlights if they skip
    }
}

// 5. Random Sentence
function loadRandomSentence() {
    lastClickedWord = ""; // Clear highlight state
    const randomIndex = Math.floor(Math.random() * database.length);
    renderSentence(database[randomIndex]);
}

// 6. UI Helpers
function updateStreak() {
    streak++;
    document.getElementById('streak-counter').textContent = streak;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.opacity = 1;
    setTimeout(() => {
        toast.style.opacity = 0;
    }, 2000);
}
