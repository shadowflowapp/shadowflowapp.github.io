// app.js
document.addEventListener('DOMContentLoaded', () => {
    const resultsContainer = document.getElementById('results');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const alphabetNav = document.getElementById('alphabetNav');
    const loadingIndicator = document.getElementById('loading');
    
    // In-memory cache to prevent re-fetching the same JSONL files
    const dbCache = {};

    // Generate A-Z navigation
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    letters.forEach(letter => {
        const btn = document.createElement('button');
        btn.textContent = letter.toUpperCase();
        btn.onclick = () => loadWordsByLetter(letter);
        alphabetNav.appendChild(btn);
    });

    // Speak function using native Web Speech API (American English)
    window.speakWord = function(text) {
        if (!('speechSynthesis' in window)) {
            alert('Your browser does not support text-to-speech.');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        // Optional: Adjust rate and pitch for clarity
        utterance.rate = 0.9; 
        window.speechSynthesis.speak(utterance);
    };

    // Load JSONL file for a specific letter
    async function fetchLetterDatabase(letter) {
        if (dbCache[letter]) return dbCache[letter];

        try {
            loadingIndicator.style.display = 'block';
            const response = await fetch(`db/${letter}.jsonl`);
            if (!response.ok) throw new Error('Database file not found');
            
            const text = await response.text();
            // Parse JSONL: split by newlines, filter empty lines, parse JSON
            const words = text.split('\n')
                .filter(line => line.trim() !== '')
                .map(line => JSON.parse(line));
            
            dbCache[letter] = words;
            return words;
        } catch (error) {
            console.error(`Error loading ${letter}.jsonl:`, error);
            return [];
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Browse by letter
    async function loadWordsByLetter(letter) {
        // Update active button styling
        document.querySelectorAll('.alphabet-nav button').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase() === letter);
        });

        resultsContainer.innerHTML = '';
        const words = await fetchLetterDatabase(letter);
        
        if (words.length === 0) {
            resultsContainer.innerHTML = '<p>No words found or database missing for this letter.</p>';
            return;
        }

        renderWords(words);
    }

    // Search function
    async function handleSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        // Determine which file to load based on the first letter
        const firstLetter = query.charAt(0);
        if (!letters.includes(firstLetter)) {
            resultsContainer.innerHTML = '<p>Please search for English words starting with A-Z.</p>';
            return;
        }

        resultsContainer.innerHTML = '';
        const words = await fetchLetterDatabase(firstLetter);
        
        // Filter words that start with or match the search query
        const filteredWords = words.filter(w => w.word.toLowerCase().includes(query));
        
        if (filteredWords.length === 0) {
            resultsContainer.innerHTML = '<p>Word not found.</p>';
            return;
        }

        renderWords(filteredWords);
    }

    // Render cards to DOM
    function renderWords(wordsToRender) {
        resultsContainer.innerHTML = '';
        wordsToRender.forEach(data => {
            const card = document.createElement('div');
            card.className = 'word-card';
            card.innerHTML = `
                <div class="word-header">
                    <div>
                        <span class="word-title">${data.word}</span>
                        <span class="word-pos">(${data.pos})</span>
                    </div>
                    <button class="listen-btn" onclick="speakWord('${data.word}')">
                        🔊 Listen
                    </button>
                </div>
                <div class="word-thai">${data.meaning_th}</div>
                ${data.example ? `<div class="word-example"><strong>Example:</strong> ${data.example}</div>` : ''}
            `;
            resultsContainer.appendChild(card);
        });
    }

    // Event Listeners for Search
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Load 'A' by default on startup
    loadWordsByLetter('a');
});
