const app = {
    db: [],
    topics: [],
    currentQuiz: [],
    currentQuestionIndex: 0,
    selectedAnswer: null,
    isSubmitted: false,

    async init() {
        try {
            // Fetch and parse JSONL database
            const response = await fetch('db.jsonl');
            const text = await response.text();
            
            // Parse each line, ignoring empty lines
            this.db = text.split('\n')
                .filter(line => line.trim() !== '')
                .map(line => JSON.parse(line));

            // Extract unique topics
            this.topics = [...new Set(this.db.map(q => q.topic))];
            
            this.renderDashboardTopics();
            this.showDashboard();
        } catch (error) {
            console.error("Failed to load database:", error);
            document.getElementById('loading-view').innerHTML = "Failed to load database. Please try again.";
        }
    },

    showDashboard() {
        document.getElementById('loading-view').classList.add('hidden');
        document.getElementById('quiz-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
    },

    renderDashboardTopics() {
        const topicsList = document.getElementById('topics-list');
        topicsList.innerHTML = this.topics.map(topic => `
            <div onclick="app.startQuiz('${topic}')" class="tap-highlight-transparent bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors">
                <h3 class="font-bold text-slate-200">${topic}</h3>
                <span class="text-indigo-400 text-sm font-bold">Play &rarr;</span>
            </div>
        `).join('');
    },

    startQuiz(filter) {
        if (filter === 'mix') {
            // Shuffle all questions
            this.currentQuiz = [...this.db].sort(() => Math.random() - 0.5);
        } else {
            // Filter by topic
            this.currentQuiz = this.db.filter(q => q.topic === filter);
        }
        
        this.currentQuestionIndex = 0;
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('quiz-view').classList.remove('hidden');
        
        this.renderQuestion();
    },

    renderQuestion() {
        this.selectedAnswer = null;
        this.isSubmitted = false;
        
        const q = this.currentQuiz[this.currentQuestionIndex];
        
        // Update Progress
        const progressPct = ((this.currentQuestionIndex) / this.currentQuiz.length) * 100;
        document.getElementById('progress-bar').style.width = `${progressPct}%`;
        
        // Populate Question Texts
        document.getElementById('question-topic').textContent = q.topic;
        document.getElementById('question-text').textContent = q.text;

        // Handle Optional Figure
        const figContainer = document.getElementById('question-figure');
        const figImg = document.getElementById('figure-img');
        if (q.figure_url) {
            figImg.src = q.figure_url;
            figContainer.classList.remove('hidden');
        } else {
            figContainer.classList.add('hidden');
        }

        // Render 3x3 Grid
        const grid = document.getElementById('choices-grid');
        grid.innerHTML = q.choices.map((choice, index) => `
            <button id="choice-${index}" onclick="app.selectAnswer(${index})" class="tap-highlight-transparent flex items-center justify-center text-center p-2 sm:p-4 rounded-xl border-2 font-medium transition-all active:scale-95 text-[13px] sm:text-sm bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 min-h-[70px]">
                ${choice}
            </button>
        `).join('');

        this.updateActionBtn();
    },

    selectAnswer(index) {
        if (this.isSubmitted) return;
        this.selectedAnswer = index;
        
        // Reset styles for all buttons
        const q = this.currentQuiz[this.currentQuestionIndex];
        q.choices.forEach((_, i) => {
            const btn = document.getElementById(`choice-${i}`);
            btn.className = "tap-highlight-transparent flex items-center justify-center text-center p-2 sm:p-4 rounded-xl border-2 font-medium transition-all active:scale-95 text-[13px] sm:text-sm min-h-[70px] bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700";
        });

        // Highlight selected
        const selectedBtn = document.getElementById(`choice-${index}`); selectedBtn.classList.remove('bg-slate-800', 'border-slate-700', 'text-slate-200'); selectedBtn.classList.add('bg-indigo-600/20', 'border-indigo-500', 'text-indigo-300');  this.updateActionBtn(); },  updateActionBtn() { const btn = document.getElementById('action-btn'); if (this.isSubmitted) { btn.textContent = "Continue"; btn.classList.replace('bg-slate-800', 'bg-indigo-600'); btn.classList.replace('text-slate-500', 'text-white'); btn.disabled = false; btn.onclick = () => this.nextQuestion(); } else if (this.selectedAnswer !== null) { btn.textContent = "Check Answer"; btn.classList.replace('bg-slate-800', 'bg-indigo-600'); btn.classList.replace('text-slate-500', 'text-white'); btn.disabled = false; btn.onclick = () => this.checkAnswer(); } else { btn.textContent = "Select an answer"; btn.classList.add('bg-slate-800', 'text-slate-500'); btn.classList.remove('bg-indigo-600', 'text-white'); btn.disabled = true; } },  checkAnswer() { this.isSubmitted = true; const q = this.currentQuiz[this.currentQuestionIndex];  // Apply feedback colors to the 3x3 grid q.choices.forEach((_, i) => { const btn = document.getElementById(`choice-${i}`);
            btn.classList.remove('bg-indigo-600/20', 'border-indigo-500', 'text-indigo-300', 'hover:bg-slate-700');
            
            if (i === q.correctIndex) {
                // Correct answer becomes Green
                btn.classList.add('bg-emerald-500/20', 'border-emerald-500', 'text-emerald-400', 'shadow-[0_0_15px_rgba(16,185,129,0.2)]');
            } else if (i === this.selectedAnswer) {
                // Wrong selected answer becomes Red
                btn.classList.add('bg-rose-500/20', 'border-rose-500', 'text-rose-400');
            } else {
                // Unselected answers fade out
                btn.classList.add('bg-slate-800/50', 'border-slate-800', 'text-slate-500', 'opacity-40');
            }
        });

        // Update footer area visually based on success/fail
        const footer = document.getElementById('quiz-footer');
        if (this.selectedAnswer === q.correctIndex) {
            footer.classList.replace('bg-slate-900', 'bg-emerald-900/20');
        } else {
            footer.classList.replace('bg-slate-900', 'bg-rose-900/20');
        }

        this.updateActionBtn();
    },

    nextQuestion() {
        // Reset footer style
        const footer = document.getElementById('quiz-footer');
        footer.classList.remove('bg-emerald-900/20', 'bg-rose-900/20');
        footer.classList.add('bg-slate-900');

        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.currentQuiz.length) {
            this.renderQuestion();
        } else {
            // Quiz Finished
            alert("Quiz Complete! Great job.");
            this.showDashboard();
        }
    }
};

// Initialize App on load
window.addEventListener('DOMContentLoaded', () => app.init());
