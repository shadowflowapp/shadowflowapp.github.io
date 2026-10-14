let database = [];
let streak = 0;

// 1. Fetch the JSON database on load
fetch('db.json')
    .then(response => response.json())
    .then(data => {
        database = data;
        // Load the first sentence without increasing the streak
        loadRandomSentence(false); 
    })
    .catch(error => {
        console.error('Error loading DB:', error);
        document.getElementById('english-sentence').textContent = "Error loading data.";
    });

// 2. Render the sentence with a fade transition
function renderSentence(sentenceObj) {
    const contentArea = document.getElementById('content-area');
    
    // Fade out
    contentArea.style.opacity = 0;

    setTimeout(() => {
        // Update text
        document.getElementById('english-sentence').textContent = sentenceObj.en;
        document.getElementById('thai-translation').textContent = sentenceObj.th;
        
        // Fade in
        contentArea.style.opacity = 1;
    }, 300); // 300ms matches the CSS transition time
}

// 3. Triggered by the main button
function loadNextSentence() {
    loadRandomSentence(true);
}

// 4. Core logic to pick a random sentence and update UI
function loadRandomSentence(incrementStreak) {
    if (database.length === 0) return;

    if (incrementStreak) {
        streak++;
        document.getElementById('streak-counter').textContent = streak;
    }

    const randomIndex = Math.floor(Math.random() * database.length);
    renderSentence(database[randomIndex]);
}
