let database = [];
let currentRootIndex = 0;
let currentFormIndex = 0;

let quizSentences = [];
let currentQuizIndex = 0;

// Initialize Web Speech API
const synth = window.speechSynthesis;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        buildRootSelector();
        loadRootWord(currentRootIndex);
    })
    .catch(err => console.error("Error loading DB", err));

// Utility: Shuffle
function shuffle(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

// 2. Build the Top Scrollable Root Selector
function buildRootSelector() {
    const selector = document.getElementById('root-selector');
    selector.innerHTML = '';

    database.forEach((rootData, idx) => {
        const pill = document.createElement('div');
        pill.className = `root-pill`;
        pill.id = `root-pill-${idx}`;
        pill.innerText = rootData.root;
        pill.onclick = () => loadRootWord(idx);
        selector.appendChild(pill);
    });
}

// 3. Load Root Word Family
function loadRootWord(index) {
    currentRootIndex = index;
    const rootData = database[index];
    
    // Update Top Panel UI and scroll into view
    document.querySelectorAll('.root-pill').forEach((pill, idx) => {
        if (idx === index) {
            pill.classList.add('active');
            pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
            pill.classList.remove('active');
        }
    });
    
    // Generate Form Selector Sub-Pills
    const selector = document.getElementById('form-selector');
    selector.innerHTML = '';
    
    rootData.forms.forEach((formObj, idx) => {
        const pill = document.createElement('div');
        pill.className = `form-pill`;
        pill.innerText = formObj.word;
        pill.onclick = () => selectForm(idx);
        selector.appendChild(pill);
    });

    // Make sure we switch back to study mode if we clicked this from a quiz
    document.getElementById('study-container').style.display = 'flex';
    document.getElementById('quiz-container').style.display = 'none';

    selectForm(0);
}

// 4. Render Study Content with Audio Buttons
function selectForm(formIdx) {
    currentFormIndex = formIdx;
    const rootData = database[currentRootIndex];
    const formObj = rootData.forms[formIdx];

    // Update Sub-Pill styling
    document.querySelectorAll('.form-pill').forEach((pill, idx) => {
        pill.classList.toggle('active', idx === formIdx);
        if (idx === formIdx) {
            pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });

    // Populate Title with Audio Button
    const titleContainer = document.getElementById('form-title-container');
    titleContainer.innerHTML = ''; // Clear existing
    
    const titleText = document.createElement('span');
    titleText.className = 'form-title';
    titleText.innerText = formObj.word;
    
    const titleAudio = document.createElement('button');
    titleAudio.className = 'icon-btn';
    titleAudio.innerText = '🔊';
    titleAudio.onclick = () => speakText(formObj.word);

    titleContainer.appendChild(titleText);
    titleContainer.appendChild(titleAudio);

    // Populate Meta Info
    document.getElementById('form-pos').innerText = formObj.pos;
    document.getElementById('form-def').innerText = formObj.definition;

    // Populate Sentences
    const sentencesContainer = document.getElementById('sentences-container');
    sentencesContainer.innerHTML = '';

    formObj.sentences.forEach(sentence => {
        // Create elements securely to avoid quote-escaping bugs in audio strings
        const block = document.createElement('div');
        block.className = 'sentence-block';
        
        const header = document.createElement('div');
        header.className = 'sentence-header';

        const enDiv = document.createElement('div');
        enDiv.className = 'english-sentence';
        // Highlight the target word dynamically
        const regex = new RegExp(`\\b(${formObj.word}[a-z]*)\\b`, 'gi');
        enDiv.innerHTML = sentence.en.replace(regex, `<span class="target-highlight">$1</span>`);

        const audioBtn = document.createElement('button');
        audioBtn.className = 'icon-btn';
        audioBtn.innerText = '🔊';
        audioBtn.onclick = () => speakText(sentence.en);

        header.appendChild(enDiv);
        header.appendChild(audioBtn);

        const thDiv = document.createElement('div');
        thDiv.className = 'thai-bridge';
        thDiv.innerText = sentence.th;

        block.appendChild(header);
        block.appendChild(thDiv);
        
        sentencesContainer.appendChild(block);
    });
}

// 5. Centralized Speech Function
function speakText(text) {
    if (synth.speaking) synth.cancel(); 
    
    const utterThis = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    
    // Attempt to locate standard American Male voices
    const maleUSIdentifiers = ['David', 'Alex', 'Aaron', 'Google US English'];
    let selectedVoice = voices.find(v => 
        v.lang.includes('en-US') && 
        maleUSIdentifiers.some(id => v.name.includes(id))
    );
    
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('en-US'));
    }

    if (selectedVoice) {
        utterThis.voice = selectedVoice;
    }
    
    utterThis.rate = 0.9; 
    synth.speak(utterThis);
}
speechSynthesis.onvoiceschanged = () => { synth.getVoices(); };


// 6. Grammar / Syntax Boss Fight (The Quiz)
function startSyntaxQuiz() {
    document.getElementById('study-container').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'flex';

    const rootData = database[currentRootIndex];
    
    // Gather all sentences from all forms to create a quiz pool
    quizSentences = [];
    rootData.forms.forEach(formObj => {
        formObj.sentences.forEach(sentence => {
            quizSentences.push({
                sentence: sentence.en,
                answer: formObj.word
            });
        });
    });

    quizSentences = shuffle(quizSentences).slice(0, 5); // Take 5 random sentences
    currentQuizIndex = 0;
    
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const quizData = quizSentences[currentQuizIndex];
    const rootData = database[currentRootIndex];

    // Blank out the specific word form
    const regex = new RegExp(`\\b${quizData.answer}\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = quizData.sentence.replace(regex, `<span class="blank" id="quiz-blank">____</span>`);

    // The Options are ALL the different forms of the root word!
    let allForms = rootData.forms.map(f => f.word);
    allForms = shuffle(allForms);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    // Display up to 6 forms as options
    allForms.slice(0, 6).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkSyntaxAnswer(btn, opt, quizData.answer);
        grid.appendChild(btn);
    });
}

function checkSyntaxAnswer(btn, selectedOption, correctAnswer) {
    const blank = document.getElementById('quiz-blank');
    blank.innerText = correctAnswer;
    blank.style.borderBottomColor = 'transparent';

    if (selectedOption === correctAnswer) {
        btn.classList.add('correct');
        blank.style.color = 'var(--correct-color)';
        
        setTimeout(() => {
            currentQuizIndex++;
            if (currentQuizIndex < quizSentences.length) {
                renderQuizQuestion();
            } else {
                alert(`Perfect! You've mastered the "${database[currentRootIndex].root}" family.`);
                // Move to next root word
                currentRootIndex = (currentRootIndex + 1) % database.length;
                loadRootWord(currentRootIndex);
            }
        }, 1000);
    } else {
        btn.classList.add('wrong');
        blank.style.color = 'var(--text-main)';

        // Highlight correct
        document.querySelectorAll('.option-btn').forEach(b => {
            if(b.innerText === correctAnswer) b.classList.add('correct');
        });

        setTimeout(() => {
            alert(`Grammar check! The correct form was "${correctAnswer}". Let's review this word family.`);
            document.getElementById('study-container').style.display = 'flex';
            document.getElementById('quiz-container').style.display = 'none';
            selectForm(0);
        }, 2500);
    }
}
