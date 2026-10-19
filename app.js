let database = [];
let currentRootIndex = 0;
let currentFormIndex = 0;

let quizSentences = [];
let currentQuizIndex = 0;

// 1. Fetch JSONL Database
fetch('db.jsonl')
    .then(response => response.text())
    .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        database = lines.map(line => JSON.parse(line));
        
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

// 2. Load Root Word Family
function loadRootWord(index) {
    const rootData = database[index];
    document.getElementById('root-word').innerText = rootData.root;
    
    // Generate Form Selector Pills
    const selector = document.getElementById('form-selector');
    selector.innerHTML = '';
    
    rootData.forms.forEach((formObj, idx) => {
        const pill = document.createElement('div');
        pill.className = `form-pill ${idx === 0 ? 'active' : ''}`;
        pill.innerText = formObj.word;
        pill.onclick = () => selectForm(idx);
        selector.appendChild(pill);
    });

    selectForm(0);
}

// 3. Render Study Content for Selected Form
function selectForm(formIdx) {
    currentFormIndex = formIdx;
    const rootData = database[currentRootIndex];
    const formObj = rootData.forms[formIdx];

    // Update Pill styling
    document.querySelectorAll('.form-pill').forEach((pill, idx) => {
        pill.classList.toggle('active', idx === formIdx);
    });

    // Populate Card
    document.getElementById('form-title').innerText = formObj.word;
    document.getElementById('form-pos').innerText = formObj.pos;
    document.getElementById('form-def').innerText = formObj.definition;

    const sentencesContainer = document.getElementById('sentences-container');
    sentencesContainer.innerHTML = '';

    formObj.sentences.forEach(sentence => {
        const block = document.createElement('div');
        block.className = 'sentence-block';
        
        // Highlight the specific form word in the English sentence
        const regex = new RegExp(`\\b(${formObj.word}[a-z]*)\\b`, 'gi');
        const highlightedEn = sentence.en.replace(regex, `<span class="target-highlight">$1</span>`);

        block.innerHTML = `
            <div class="english-sentence">${highlightedEn}</div>
            <div class="thai-bridge">${sentence.th}</div>
        `;
        sentencesContainer.appendChild(block);
    });
}

// 4. Grammar / Syntax Boss Fight (The Quiz)
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
                document.getElementById('study-container').style.display = 'flex';
                document.getElementById('quiz-container').style.display = 'none';
                
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
