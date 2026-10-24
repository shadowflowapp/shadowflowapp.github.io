let db = {};
let currentTopic = "";
let currentQuestionIndex = 0;
let score = 0;

// DOM Elements
const viewTopic = document.getElementById('topic-view');
const viewQuiz = document.getElementById('quiz-view');
const viewResult = document.getElementById('result-view');
const topicListDiv = document.getElementById('topic-list');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const progressIndicator = document.getElementById('progress-indicator');
const explanationBox = document.getElementById('explanation-box');
const nextBtn = document.getElementById('next-btn');
const scoreDisplay = document.getElementById('score-display');

// Initialize App
async function initApp() {
    try {
        const response = await fetch('db.json');
        if (!response.ok) throw new Error("Network response was not ok");
        db = await response.json();
        renderTopicMenu();
    } catch (error) {
        topicListDiv.innerHTML = "<p style='color:red;'>Error loading database (CORS issue). Ensure you run this via a local web server.</p>";
        console.error("Fetch error: ", error);
    }
}

// 1. Render Topics
function renderTopicMenu() {
    topicListDiv.innerHTML = "";
    Object.keys(db).forEach(topic => {
        const btn = document.createElement('button');
        btn.className = 'topic-btn';
        btn.innerHTML = `<strong>${topic}</strong> <br><span style="font-size:0.85rem; color:var(--text-sub);">${db[topic].length} Questions</span>`;
        btn.onclick = () => startTopic(topic);
        topicListDiv.appendChild(btn);
    });
}

// Switches UI views safely
function switchView(viewElement) {
    viewTopic.classList.remove('active-view');
    viewQuiz.classList.remove('active-view');
    viewResult.classList.remove('active-view');
    viewElement.classList.add('active-view');
}

// 2. Start a Topic
function startTopic(topic) {
    currentTopic = topic;
    currentQuestionIndex = 0;
    score = 0;
    switchView(viewQuiz);
    loadQuestion();
}

// 3. Load Current Question (Fixed Order)
function loadQuestion() {
    const questionData = db[currentTopic][currentQuestionIndex];
    const totalQ = db[currentTopic].length;
    
    // Reset UI
    explanationBox.style.display = 'none';
    nextBtn.disabled = true;
    
    // Update text
    progressIndicator.textContent = `${currentTopic} • Question ${currentQuestionIndex + 1} of ${totalQ}`;
    questionText.textContent = questionData.question;
    
    // Generate Options
    optionsContainer.innerHTML = "";
    questionData.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = optText;
        btn.onclick = () => handleAnswer(btn, index, questionData.correct, questionData.explanation);
        optionsContainer.appendChild(btn);
    });
}

// 4. Handle Answer Checking
function handleAnswer(selectedBtn, selectedIndex, correctIndex, explanationText) {
    // Disable all buttons to prevent multiple clicks
    const allOptions = document.querySelectorAll('.option-btn');
    allOptions.forEach(btn => btn.disabled = true);

    // Check correctness
    if (selectedIndex === correctIndex) {
        selectedBtn.classList.add('correct');
        score++;
    } else {
        selectedBtn.classList.add('wrong');
        // Highlight the correct one
        allOptions[correctIndex].classList.add('correct');
    }

    // Show Explanation
    explanationBox.innerHTML = `<strong>Explanation:</strong> ${explanationText}`;
    explanationBox.style.display = 'block';

    // Enable Next Button
    nextBtn.disabled = false;
}

// 5. Next Button Logic
nextBtn.addEventListener('click', () => {
    const totalQ = db[currentTopic].length;
    if (currentQuestionIndex < totalQ - 1) {
        currentQuestionIndex++;
        loadQuestion();
    } else {
        showResults();
    }
});

// 6. Show Results
function showResults() {
    switchView(viewResult);
    const totalQ = db[currentTopic].length;
    scoreDisplay.textContent = `${score} / ${totalQ}`;
}

// 7. Return to Menu
function showTopicMenu() {
    switchView(viewTopic);
}

// Boot up
initApp();
