// Hardcoded MVP database (expand by loading db.jsonl in production)
const db = [
    {w: "abandon", p: "v.", t: "ละทิ้ง, ปล่อย"},
    {w: "ability", p: "n.", t: "ความสามารถ"},
    {w: "able", p: "adj.", t: "สามารถ"},
    {w: "abnormal", p: "adj.", t: "ผิดปกติ"},
    {w: "aboard", p: "adv.", t: "บนเรือ, บนรถไฟ"},
    {w: "abolish", p: "v.", t: "ยกเลิก, ล้มล้าง"},
    {w: "abort", p: "v.", t: "ยกเลิก, ทำแท้ง"},
    {w: "about", p: "prep.", t: "เกี่ยวกับ, ประมาณ"},
    {w: "above", p: "prep.", t: "เหนือ, สูงกว่า"},
    {w: "abroad", p: "adv.", t: "ต่างประเทศ"},
    {w: "absence", p: "n.", t: "การขาด, การไม่อยู่"},
    {w: "absent", p: "adj.", t: "ขาด, ไม่อยู่"},
    {w: "absolute", p: "adj.", t: "สมบูรณ์, แน่นอน"},
    {w: "absorb", p: "v.", t: "ดูดซับ, รับรู้"},
    {w: "abstract", p: "adj.", t: "นามธรรม"}
];

let currentIndex = 0;
let score = 0;

// Speech Setup
const synth = window.speechSynthesis;
let americanMaleVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    americanMaleVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('Google')));
    if(!americanMaleVoice) americanMaleVoice = voices.find(v => v.lang === 'en-US');
};

function playAudio(word = null) {
    const textToSpeak = word || db[currentIndex].w;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if(americanMaleVoice) utterance.voice = americanMaleVoice;
    utterance.rate = 0.9; 
    synth.speak(utterance);
}

function updateUI() {
    const currentWord = db[currentIndex];
    document.getElementById('word').innerText = currentWord.w;
    document.getElementById('pos').innerText = currentWord.p;
    document.getElementById('thai').innerText = currentWord.t;
    document.getElementById('score').innerText = score;
    playAudio();
}

function prevWord() {
    if (currentIndex > 0) {
        currentIndex--;
        updateUI();
    }
}

function nextWord() {
    if (currentIndex < db.length - 1) {
        // Did they just finish learning 10 new words? Trigger Deathrun on moving to the 11th.
        if (score === currentIndex && (currentIndex + 1) % 10 === 0) {
            score++;
            startDeathrun();
            return;
        }

        currentIndex++;
        if (currentIndex > score) score = currentIndex;
        
        updateUI();
    }
}

// --- DEATHRUN MECHANIC ---

let deathrunTimer;
let timeLeft;
let questionsToPass = 3;
let currentQuestionIndex = 0;
let currentDeathrunWord = {};

function startDeathrun() {
    document.getElementById('quiz-container').style.display = 'flex';
    document.getElementById('app-container').classList.add('shaking');
    
    // Play scary alert sound (using Web Audio API beep)
    let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = audioCtx.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // low buzz
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);

    timeLeft = 10.0;
    currentQuestionIndex = 0;
    generateQuizQuestion();
    
    deathrunTimer = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timer').innerText = timeLeft.toFixed(1);
        
        if (timeLeft <= 0) {
            failDeathrun();
        }
    }, 100);
}

function generateQuizQuestion() {
    document.getElementById('quiz-progress').innerText = `${currentQuestionIndex + 1}/${questionsToPass}`;
    
    // Get a random word from the last 10 words learned
    const minIndex = currentIndex - 9;
    const randomIndex = Math.floor(Math.random() * 10) + minIndex;
    currentDeathrunWord = db[randomIndex];

    document.getElementById('quiz-word').innerText = currentDeathrunWord.w;
    
    // Generate options (1 correct, 3 random wrong answers)
    let options = [currentDeathrunWord.t];
    while(options.length < 4) {
        let randomWrong = db[Math.floor(Math.random() * db.length)].t;
        if(!options.includes(randomWrong)) {
            options.push(randomWrong);
        }
    }
    
    // Shuffle options
    options.sort(() => Math.random() - 0.5);
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(opt);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedThai) {
    if (selectedThai === currentDeathrunWord.t) {
        // Correct!
        currentQuestionIndex++;
        if (currentQuestionIndex >= questionsToPass) {
            passDeathrun();
        } else {
            generateQuizQuestion(); // Next rapid fire question
        }
    } else {
        // Wrong! Immediate death.
        failDeathrun();
    }
}

function passDeathrun() {
    clearInterval(deathrunTimer);
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('app-container').classList.remove('shaking');
    
    // Mr Beast Confetti
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ffcc00', '#ffffff', '#4CAF50']
    });

    currentIndex++;
    if (currentIndex > score) score = currentIndex;
    updateUI();
}

function failDeathrun() {
    clearInterval(deathrunTimer);
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('app-container').classList.remove('shaking');
    
    alert("💀 YOU DIED! You must review the last 10 words again!");
    
    // Punishment: Push them back 9 words so they have to review
    currentIndex = currentIndex - 9;
    score = currentIndex; // Reset their real score to match the punishment
    updateUI();
}

// Init
updateUI();
