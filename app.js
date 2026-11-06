document.addEventListener("DOMContentLoaded", () => {
  const alphabetNav = document.getElementById("alphabet-nav");
  const contentArea = document.getElementById("content-area");
  
  const wordDisplay = document.getElementById("word-display");
  const posDisplay = document.getElementById("pos-display");
  const ipaDisplay = document.getElementById("ipa-display");
  const definitionDisplay = document.getElementById("definition-display");
  const sentenceDisplay = document.getElementById("sentence-display");
  
  const playWordBtn = document.getElementById("play-word-btn");
  const playSentenceBtn = document.getElementById("play-sentence-btn");
  
  const wordSlider = document.getElementById("word-slider");
  const sliderCurrent = document.getElementById("slider-current");
  const sliderTotal = document.getElementById("slider-total");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  let currentWords = [];
  let currentIndex = 0;
  let autoplayTimeout = null;
  let userInteracted = false; 
  
  const posMap = {
    "noun": "n.",
    "verb": "v.",
    "adjective": "adj.",
    "adverb": "adv.",
    "preposition": "prep.",
    "pronoun": "pron.",
    "conjunction": "conj.",
    "interjection": "interj."
  };

  const markInteraction = () => userInteracted = true;
  document.body.addEventListener("click", markInteraction, { once: true });
  document.body.addEventListener("keydown", markInteraction, { once: true });
  document.body.addEventListener("touchstart", markInteraction, { once: true });

  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  alphabet.forEach(letter => {
    const btn = document.createElement("button");
    btn.textContent = letter.toUpperCase();
    btn.className = "letter-btn";
    if (letter === "a") btn.classList.add("active");
    
    btn.addEventListener("click", () => {
      document.querySelectorAll(".letter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      loadLetterData(letter);
    });
    alphabetNav.appendChild(btn);
  });

  async function loadLetterData(letter) {
    wordDisplay.textContent = "Loading...";
    posDisplay.textContent = "";
    ipaDisplay.textContent = "";
    definitionDisplay.textContent = "";
    sentenceDisplay.innerHTML = "";
    
    try {
      const response = await fetch(`db/${letter}.jsonl`);
      if (!response.ok) throw new Error("Letter file not found");
      
      const text = await response.text();
      currentWords = text.split("\n")
                         .filter(line => line.trim() !== "")
                         .map(line => JSON.parse(line));
      
      currentIndex = 0;
      updateUI();
    } catch (error) {
      currentWords = [];
      wordDisplay.textContent = "Data Missing";
      definitionDisplay.textContent = "";
      sentenceDisplay.textContent = `Could not load db/${letter}.jsonl`;
      updateUI();
    }
  }

  function updateUI() {
    if (currentWords.length === 0) {
      wordSlider.max = 0; wordSlider.value = 0;
      sliderCurrent.textContent = "0"; sliderTotal.textContent = "0";
      prevBtn.disabled = true; nextBtn.disabled = true;
      return;
    }

    const data = currentWords[currentIndex];
    
    wordDisplay.textContent = data.word;
    ipaDisplay.textContent = data.ipa || "";
    definitionDisplay.textContent = data.definition || "";
    
    const rawPos = (data.pos || "").toLowerCase();
    posDisplay.textContent = posMap[rawPos] || data.pos;

    // Highlight the target word in the sentence
    if (data.sentence) {
      const regex = new RegExp(`\\b(${data.word})\\b`, 'gi');
      const highlightedSentence = data.sentence.replace(regex, `<span class="highlight">$1</span>`);
      sentenceDisplay.innerHTML = highlightedSentence;
    }

    wordSlider.max = currentWords.length - 1;
    wordSlider.value = currentIndex;
    sliderCurrent.textContent = currentIndex + 1;
    sliderTotal.textContent = currentWords.length;

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentWords.length - 1;

    window.speechSynthesis.cancel();
    clearTimeout(autoplayTimeout);
    
    autoplayTimeout = setTimeout(() => {
      if (currentWords.length > 0 && userInteracted) {
        speakText(currentWords[currentIndex].word);
      }
    }, 300);
  }

  function goPrev() {
    if (currentIndex > 0) { currentIndex--; updateUI(); }
  }
  
  function goNext() {
    if (currentIndex < currentWords.length - 1) { currentIndex++; updateUI(); }
  }

  prevBtn.addEventListener("click", goPrev);
  nextBtn.addEventListener("click", goNext);
  
  wordSlider.addEventListener("input", (e) => {
    currentIndex = parseInt(e.target.value, 10);
    updateUI();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
  });

  let touchStartX = 0;
  let touchEndX = 0;

  contentArea.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  contentArea.addEventListener("touchend", e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 50; 
    if (touchEndX + swipeThreshold < touchStartX) goNext(); 
    if (touchEndX - swipeThreshold > touchStartX) goPrev(); 
  }

  function speakText(text) {
    if (!text) return;
    window.speechSynthesis.cancel(); 
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const usVoices = voices.filter(v => v.lang.startsWith("en-US"));
    const maleVoice = usVoices.find(v => v.name.includes("David") || v.name.includes("Alex") || v.name.includes("Guy") || v.name.includes("Matthew"));
    
    if (maleVoice) utterance.voice = maleVoice;
    else if (usVoices.length > 0) utterance.voice = usVoices[0];
    
    window.speechSynthesis.speak(utterance);
  }

  playWordBtn.addEventListener("click", () => {
    if (currentWords.length > 0) speakText(currentWords[currentIndex].word);
  });

  playSentenceBtn.addEventListener("click", () => {
    if (currentWords.length > 0) speakText(currentWords[currentIndex].sentence);
  });

  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

  loadLetterData("a");
});
