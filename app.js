let database = [];
let currentSentenceId = null;
let streak = 0;

// 1. Fetch the JSON database
fetch('db.json')
    .then(response => response.json())
    .then(data => {
        database = data;
        loadRandomSentence();
    })
    .catch(error => console.error('Error loading DB:', error));

// 2. Render the sentence and make words clickable
function renderSentence(sentenceObj) {
    currentSentenceId = sentenceObj.id;
    const englishContainer = document.getElementById('english-sentence');
    const thaiContainer = document.getElementById('thai-translation');
    
    englishContainer.innerHTML = ''; // Clear previous
    thaiContainer.textContent = sentenceObj.th;

    // Split sentence into words, preserving spaces
    const words = sentenceObj.en.split(' ');

    words.forEach(word => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.className = 'clickable-word';
        
        // Clean the word for searching (remove punctuation and make lowercase)
        const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();
        
        span.onclick = () => handleWordClick(cleanWord);
        englishContainer.appendChild(span);
    });
}

// 3. Handle the click mechanic
function handleWordClick(clickedWord) {
    // Find all sentences containing this exact word (excluding the current one)
    const matches = database.filter(item => {
        if (item.id === currentSentenceId) return false;
        
        // Use regex to ensure we match whole words only, ignoring case
        const regex = new RegExp(`\\b${clickedWord}\\b`, 'i');
        return regex.test(item.en);
    });

    if (matches.length > 0) {
        // Pick a random sentence from the matches
        const nextSentence = matches[Math.floor(Math.random() * matches.length)];
        updateStreak();
        renderSentence(nextSentence);
    } else {
        // Fallback if the word isn't in other sentences yet
        alert(`No other sentences found with "${clickedWord}". Let's try a random one!`);
        loadRandomSentence();
    }
}

function loadRandomSentence() {
    const randomIndex = Math.floor(Math.random() * database.length);
    renderSentence(database[randomIndex]);
}

function updateStreak() {
    streak++;
    document.getElementById('streak-counter').textContent = streak;
}
