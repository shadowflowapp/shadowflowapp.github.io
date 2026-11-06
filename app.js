document.addEventListener("DOMContentLoaded", () => {
  const alphabetNav = document.getElementById("alphabet-nav");
  const wordDisplay = document.getElementById("word-display");
  const posDisplay = document.getElementById("pos-display");
  const sentenceDisplay = document.getElementById("sentence-display");
  const playBtn = document.getElementById("play-audio-btn");
  const wordSlider = document.getElementById("word-slider");
  const sliderCurrent = document.getElementById("slider-current");
  const sliderTotal = document.getElementById("slider-total");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  let currentWords = [];
  let currentIndex = 0;
  let currentLetter = "a";

  // Build A-Z Navigation
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  alphabet.forEach(letter => {
    const btn = document.createElement("button");
    btn.textContent = letter.toUpperCase();
    btn.className = "letter-btn";
    if (letter === "a") btn.classList.add("active");
    btn.addEventListener("click", () => {
      document.querySelectorAll(".letter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Center the clicked letter in the scroll view
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      loadLetterData(letter);
    });
    alphabetNav.appendChild(btn);
  });

  // Fetch JSONL Data
  async function loadLetterData(letter) {
    currentLetter = letter;
    wordDisplay.textContent = "Loading...";
    posDisplay.textContent = "";
    sentenceDisplay.textContent = "";
    
    try {
      const response = await fetch(`db/${letter}.jsonl`);
      if (!response.ok) throw new Error("Letter file not found");
      
      const text = await response.text();
      
      // Parse JSONL (ignore empty lines)
      currentWords = text.split("\n")
                         .filter(line => line.trim() !== "")
                         .map(line => JSON.parse(line));
      
      currentIndex = 0;
      updateUI();
    } catch (error) {
      currentWords = [];
      wordDisplay.textContent = "Data Missing";
      sentenceDisplay.textContent = `Could not load db/${letter}.jsonl`;
      updateUI();
    }
  }

  // Update UI Elements
  function updateUI() {
    if (currentWords.length === 0) {
      wordSlider.max = 0;
      wordSlider.value = 0;
      sliderCurrent.textContent = "0";
      sliderTotal.textContent = "0";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    const currentData = currentWords[currentIndex];
    wordDisplay.textContent = currentData.word;
    posDisplay.textContent = currentData.pos;
    sentenceDisplay.textContent = currentData.sentence;

    wordSlider.max = currentWords.length - 1;
    wordSlider.value = currentIndex;
    sliderCurrent.textContent = currentIndex + 1;
    sliderTotal.textContent = currentWords.length;

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentWords.length - 1;
  }

  // Navigation Listeners
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateUI();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < currentWords.length - 1) {
      currentIndex++;
      updateUI();
    }
  });

  wordSlider.addEventListener("input", (e) => {
    currentIndex = parseInt(e.target.value, 10);
    updateUI();
  });

  // Audio (Web Speech API)
  function playAudio() {
    if (currentWords.length === 0) return;
    const currentData = currentWords[currentIndex];
    
    // Read word, brief pause, then sentence
    const textToSpeak = `${currentData.word}. ${currentData.sentence}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Attempt to find a male American voice (e.g., 'David', 'Alex', or standard en-US)
    const voices = window.speechSynthesis.getVoices();
    const usVoices = voices.filter(v => v.lang.startsWith("en-US"));
    const maleVoice = usVoices.find(v => v.name.includes("David") || v.name.includes("Alex") || v.name.includes("Guy") || v.name.includes("Matthew"));
    
    if (maleVoice) {
      utterance.voice = maleVoice;
    } else if (usVoices.length > 0) {
      utterance.voice = usVoices[0]; // Fallback to first available US voice
    }
    
    window.speechSynthesis.cancel(); // Stop any currently playing audio
    window.speechSynthesis.speak(utterance);
  }

  playBtn.addEventListener("click", playAudio);

  // Initialize voices (required for some browsers)
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };

  // Initial Load
  loadLetterData("a");
});
