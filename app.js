let database = [];
let currentRootIndex = 0;
let currentFormIndex = 0;
let quizSentences = [];
let currentQuizIndex = 0;

const synth = window.speechSynthesis;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
        buildRootSelector();
        loadRootWord(currentRootIndex);
        
        // Initialize PC Drag-to-Scroll feature
        enableDragToScroll(document.getElementById('root-selector'));
        enableDragToScroll(document.getElementById('form-selector'));
    })
    .catch(err => console.error("Error loading DB", err));

// Utility: Drag to Scroll for Desktop PC users
function enableDragToScroll(slider) {
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        slider.scrollLeft = scrollLeft - walk;
    });
}

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
        // We use a wrapper div so the click event fires even after dragging
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-block';
        
        const pill = document.createElement('div');
        pill.className = `root-pill`;
        pill.id = `root-pill-${idx}`;
        pill.innerText = rootData.root;
        
        wrapper.appendChild(pill);
        
        // Prevent click if user was just dragging
        let startX;
        wrapper.addEventListener('mousedown', (e) => startX = e.pageX);
        wrapper.addEventListener('mouseup', (e) => {
            if (Math.abs(e.pageX - startX) < 5) loadRootWord(idx);
        });
        
        // Mobile touch click
        wrapper.addEventListener('touchend', () => loadRootWord(idx));
        
        selector.appendChild(wrapper);
    });
}

// 3. Load Root Word Family
function loadRootWord(index) {
    currentRootIndex = index;
    const rootData = database[index];
    
    document.querySelectorAll('.root-pill').forEach((pill, idx) => {
        if (idx === index) {
            pill.classList.add('active');
            pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
            pill.classList.remove('active');
        }
    });
    
    const selector = document.getElementById('form-selector');
    selector.innerHTML = '';
    
    rootData.forms.forEach((formObj, idx) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-block';

        const pill = document.createElement('div');
        pill.className = `form-pill`;
        pill.innerText = formObj.word;
        
        wrapper.appendChild(pill);

        // Click logic (accounting for drag)
        let startX;
        wrapper.addEventListener('mousedown', (e) => startX = e.pageX);
        wrapper.addEventListener('mouseup', (e) => {
            if (Math.abs(e.pageX - startX) < 5) selectForm(idx);
        });
        wrapper.addEventListener('touchend', () => selectForm(idx));
        
        selector.appendChild(wrapper);
    });

    document.getElementById('study-container').style.display = 'flex';
    document.getElementById('quiz-container').style.display = 'none';

    selectForm(0);
}

// 4. Render Study Content with Audio Buttons
function selectForm(formIdx) {
    currentFormIndex = formIdx;
    const rootData = database[currentRootIndex];
    const formObj = rootData.forms[formIdx];

    document.querySelectorAll('.form-pill').forEach((pill, idx) => {
        pill.classList.toggle('active', idx === formIdx);
        if (idx === formIdx) {
            pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });

    // Word Audio
    const titleContainer = document.getElementById('form-title-container');
    titleContainer.innerHTML = ''; 
    const titleText = document.createElement('span');
    titleText.className = 'form-title';
    titleText.innerText = formObj.word;
    const titleAudio = document.createElement('button');
    titleAudio.className = 'icon-btn';
    titleAudio.innerText = '🔊';
    titleAudio.onclick = () => speakText(formObj.word);
    titleContainer.appendChild(titleText);
    titleContainer.appendChild(titleAudio);

    // Meta Info
    document.getElementById('form-pos').innerText = formObj.pos;
    
    // Definition Audio
    document.getElementById('form-def').innerText = formObj.definition;
    document.getElementById('def-audio-btn').onclick = () => speakText(formObj.definition);

    // Sentences
    const sentencesContainer = document.getElementById('sentences-container');
    sentencesContainer.innerHTML = '';

    formObj.sentences.forEach(sentence => {
        const block = document.createElement('div');
        block.className = 'sentence-block';
        
        const header = document.createElement('div');
        header.className = 'sentence-header';

        const enDiv = document.createElement('div');
        enDiv.className = 'english-sentence';
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

// 5. Centralized Speech Function (Strict American Male Check)
function speakText(text) {
    if (synth.speaking) synth.cancel(); 
    
    const utterThis = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    
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

// 6. Grammar / Syntax Boss Fight
function startSyntaxQuiz() {
    document.getElementById('study-container').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'flex';

    const rootData = database[currentRootIndex];
    
    quizSentences = [];
    rootData.forms.forEach(formObj => {
        formObj.sentences.forEach(sentence => {
            quizSentences.push({
                sentence: sentence.en,
                answer: formObj.word
            });
        });
    });

    quizSentences = shuffle(quizSentences).slice(0, 5);
    currentQuizIndex = 0;
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const quizData = quizSentences[currentQuizIndex];
    const rootData = database[currentRootIndex];

    const regex = new RegExp(`\\b${quizData.answer}\\b`, 'gi');
    document.getElementById('quiz-sentence').innerHTML = quizData.sentence.replace(regex, `<span class="blank" id="quiz-blank">____</span>`);

    let allForms = rootData.forms.map(f => f.word);
    allForms = shuffle(allForms);

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
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
                currentRootIndex = (currentRootIndex + 1) % database.length;
                loadRootWord(currentRootIndex);
            }
        }, 1000);
    } else {
        btn.classList.add('wrong');
        blank.style.color = 'var(--text-main)';

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
