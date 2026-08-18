import { makeStreamingRequest } from './api.js';

let currentLessonContent = "";
let selectedTheme = "";
let gameState = {
    mode: null,
    questions: [],
    currentIndex: 0,
    score: 0,
    lives: 3,
    timer: null,
    timeLeft: 20,
    targetEl: null
};

/**
 * Main entry point for Defia embedded in Professor +
 * @param {string} content - The lesson or context content
 * @param {object} options - { targetEl, cycle, discipline, competences, theme }
 */
export function initDefia(content, options) {
    currentLessonContent = content;
    gameState.targetEl = options.targetEl;
    
    // Auto-recover theme from Professor + theme field
    selectedTheme = options.theme || "Général";
    
    // Clear and reset UI
    resetGameState();
    gameState.targetEl.innerHTML = "";
    gameState.targetEl.style.display = "block";
    
    // Adjust container height for better gaming experience
    const parentContainer = gameState.targetEl.closest('.output-container');
    if (parentContainer) {
        parentContainer.style.minHeight = "700px";
    }
    
    // Step 2 directly: Show Mode Selection (Theme is already known)
    showModeSelection();
}

function resetGameState() {
    if (gameState.timer) clearInterval(gameState.timer);
    gameState = { 
        ...gameState, 
        mode: null, 
        questions: [], 
        currentIndex: 0, 
        score: 0, 
        lives: 3, 
        timer: null, 
        timeLeft: 20 
    };
}

// Internal function, no longer used as entry but kept for "Change Theme" logic if needed
async function showThemeSelection() {
    gameState.targetEl.innerHTML = `
        <div id="defia-theme-selection" style="display: flex; flex-direction: column; align-items: center; gap: 30px; animation: fadeIn 0.3s ease; padding: 20px;">
            <div style="text-align: center;">
                <h2 style="color: var(--accent5); font-size: 2.5rem; font-weight: 800; margin-bottom: 10px;">DÉFIA +</h2>
                <p style="color: var(--text-muted); font-size: 1.2rem;">Choisissez un thème pour commencer le défi</p>
            </div>

            <div id="defia-theme-proposals" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; width: 100%; max-width: 800px;">
                <div class="loader-container" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                    <div class="btn-loader" style="margin: 0 auto 15px;"></div>
                    <p>L'IA analyse le contenu pour proposer des thèmes...</p>
                </div>
            </div>

            <div style="width: 100%; max-width: 600px; display: flex; gap: 15px; border-top: 1px solid var(--border); padding-top: 30px;">
                <input type="text" id="defia-custom-theme" class="search-input" placeholder="Ou saisissez un thème libre..." style="flex:1; border-radius: 12px; height: 50px; padding-left: 20px;">
                <button class="btn btn-primary" id="defia-validate-theme-btn" style="border-radius: 12px; padding: 0 30px;">Jouer</button>
            </div>
        </div>
    `;

    const prompt = `Analyse ce contenu pédagogique et propose 4 thèmes ou concepts clés courts pour créer des jeux de révision.
CONTENU : ${currentLessonContent}
RÉPONDS UNIQUEMENT PAR UNE LISTE JSON : ["Thème 1", "Thème 2", "Thème 3", "Thème 4"]`;

    let full = "";
    try {
        await makeStreamingRequest(prompt, { tool: 'professor' }, (c, f) => full = f, () => {}, (err) => console.error(err));
        const themes = JSON.parse(full.replace(/```json|```/g, '').trim());
        const proposalsContainer = document.getElementById('defia-theme-proposals');
        if (proposalsContainer) {
            proposalsContainer.innerHTML = themes.map(t => `
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 25px; border-radius: 20px; cursor: pointer; text-align: center; font-weight: 700; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.02);" 
                     onclick="window.selectDefiaTheme('${t.replace(/'/g, "\\'")}')"
                     onmouseover="this.style.borderColor='var(--accent5)'; this.style.transform='translateY(-5px)'; this.style.background='var(--surface2)'"
                     onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none'; this.style.background='var(--surface)'">
                    ${t}
                </div>
            `).join('');
        }
    } catch (e) {
        const proposalsContainer = document.getElementById('defia-theme-proposals');
        if (proposalsContainer) proposalsContainer.innerHTML = '<p class="error">Impossible de générer des thèmes automatiquement.</p>';
    }

    window.selectDefiaTheme = (theme) => {
        if (!theme) return alert("Veuillez choisir ou saisir un thème.");
        selectedTheme = theme;
        showModeSelection();
    };

    const validateBtn = document.getElementById('defia-validate-theme-btn');
    if (validateBtn) {
        validateBtn.onclick = () => {
            const custom = document.getElementById('defia-custom-theme').value.trim();
            if (custom) window.selectDefiaTheme(custom);
            else alert("Saisissez un thème.");
        };
    }
}

function showModeSelection() {
    gameState.targetEl.innerHTML = `
        <div id="defia-menu" style="display: flex; flex-direction: column; align-items: center; gap: 30px; animation: fadeIn 0.3s ease; padding: 20px;">
            <div style="text-align: center;">
                <h3 style="color: var(--accent5); font-size: 1.8rem; font-weight: 800; margin-bottom: 5px;">Thème : ${selectedTheme}</h3>
                <p style="color: var(--text-muted); font-size: 1.1rem;">Choisissez votre type de défi</p>
            </div>
            
            <div class="mission-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; width: 100%; max-width: 900px;">
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 30px; border-radius: 24px; cursor: pointer; text-align: center; transition: 0.3s;" onclick="window.startDefiaMode('quiz')">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🎯</div>
                    <h4 style="margin-bottom: 8px; font-weight: 800;">5 Questions</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Quiz classique de compréhension.</p>
                </div>
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 30px; border-radius: 24px; cursor: pointer; text-align: center; transition: 0.3s;" onclick="window.startDefiaMode('paires')">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🔗</div>
                    <h4 style="margin-bottom: 8px; font-weight: 800;">Paires Liées</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Associez les termes correspondants.</p>
                </div>
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 30px; border-radius: 24px; cursor: pointer; text-align: center; transition: 0.3s;" onclick="window.startDefiaMode('defi_rapide')">
                    <div style="font-size: 3rem; margin-bottom: 15px;">⚡</div>
                    <h4 style="margin-bottom: 8px; font-weight: 800;">Défi Rapide</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Répondez avant la fin du chrono !</p>
                </div>
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 30px; border-radius: 24px; cursor: pointer; text-align: center; transition: 0.3s;" onclick="window.startDefiaMode('flashcards')">
                    <div style="font-size: 3rem; margin-bottom: 15px;">📇</div>
                    <h4 style="margin-bottom: 8px; font-weight: 800;">5 Flashcards</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Mémorisation active par concept.</p>
                </div>
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 30px; border-radius: 24px; cursor: pointer; text-align: center; transition: 0.3s;" onclick="window.startDefiaMode('intrus')">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🕵️</div>
                    <h4 style="margin-bottom: 8px; font-weight: 800;">Trouve l'Intrus</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Débusquez l'affirmation fausse.</p>
                </div>
                <div class="mission-card" style="background: var(--surface); border: 2px solid var(--border); padding: 30px; border-radius: 24px; cursor: pointer; text-align: center; transition: 0.3s;" onclick="window.startDefiaMode('chat')">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">🧠</div>
                    <h4 style="margin-bottom: 5px; font-weight: 700;">Interroge-moi</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Dialogue interactif avec l'IA.</p>
                </div>
            </div>
            <button class="btn btn-secondary mt-3" style="border-radius: 12px; padding: 10px 25px;" onclick="window.showThemeSelection()">← Modifier le thème</button>
        </div>
    `;
    
    window.showThemeSelection = showThemeSelection;

    window.startDefiaMode = (mode) => {
        gameState.mode = mode;
        launchGame();
    };
}

async function launchGame() {
    gameState.targetEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; padding: 20px;">
            <div id="defia-header" style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px;">
                <div style="display: flex; gap: 20px; font-weight: 800; font-size: 1.4rem;">
                    <span>🏆 <span id="defia-score">${gameState.score}</span></span>
                    <span>❤️ <span id="defia-lives">${gameState.lives}</span></span>
                </div>
                <div style="flex:1; margin: 0 30px; height: 12px; background: var(--surface3); border-radius: 6px; overflow: hidden;">
                    <div id="defia-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #3b82f6); transition: 0.4s;"></div>
                </div>
                <button class="btn btn-secondary btn-sm" id="defia-quit" style="padding: 8px 20px; border-radius: 10px;">Quitter</button>
            </div>
            <div id="defia-active-content" style="width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="text-align: center;">
                    <div class="btn-loader" style="margin: 0 auto 20px;"></div>
                    <p style="font-size: 1.2rem; font-weight: 600;">L'IA prépare vos défis personnalisés...</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('defia-quit').onclick = () => showModeSelection();

    try {
        if (gameState.mode === 'chat') {
            setupChatMode();
            return;
        }

        const questions = await generateQuestions(currentLessonContent, selectedTheme, gameState.mode);
        gameState.questions = questions;
        renderQuestion();
    } catch (err) {
        document.getElementById('defia-active-content').innerHTML = `
            <div class="question-card" style="text-align:center; padding: 40px; border-radius: 24px; background: var(--surface); border: 2px solid var(--border);">
                <p class="error" style="color: var(--danger-color); font-weight: 700; margin-bottom: 20px;">❌ Erreur : ${err.message}</p>
                <button class="btn btn-primary" style="border-radius: 12px; padding: 12px 30px;" onclick="window.showModeSelection()">Réessayer</button>
            </div>
        `;
    }
}

async function generateQuestions(text, theme, mode) {
    let count = 5;
    let formatDesc = "";
    
    if (mode === 'paires') {
        formatDesc = `un jeu d'associations (PAIRES). Chaque item doit contenir un tableau "pairs" de 4 objets {left: "concept", right: "définition/correspondance"}.`;
    } else if (mode === 'intrus') {
        formatDesc = `un jeu de type INTRUS. Chaque item doit proposer 4 affirmations ("options") : 3 VRAIES et 1 FAUSSE (l'intrus). L'index "answer" doit être celui de l'intrus.`;
    } else if (mode === 'flashcards') {
        formatDesc = `un set de FLASHCARDS. Chaque item doit avoir une "question" (recto) et un "verso" (réponse/définition).`;
    } else {
        formatDesc = `un QUIZ de questions à choix multiples. Chaque item doit avoir une "question", 4 "options" et l'index "answer" de la bonne réponse.`;
    }

    const prompt = `Tu es un expert en gamification pédagogique.
À partir du contenu suivant, génère ${count} items pour ${formatDesc} sur le thème spécifique "${theme}".

FORMAT JSON STRICT (réponds uniquement le JSON, pas de texte autour) :
{
  "items": [
    {
      "question": "Texte",
      "options": ["Choix 1", "Choix 2", "Choix 3", "Choix 4"],
      "answer": 0,
      "verso": "Réponse flashcard",
      "pairs": [{"left": "Terme", "right": "Lien"}]
    }
  ]
}

CONTENU : ${text}`;

    let fullResponse = "";
    // CRUCIAL: Provided all 5 arguments to makeStreamingRequest
    await makeStreamingRequest(
        prompt, 
        { tool: 'professor' }, 
        (chunk, full) => { fullResponse = full; },
        () => {}, 
        (err) => { console.error("Defia Stream Error:", err); }
    );

    try {
        const jsonStr = fullResponse.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);
        return data.items || data.questions;
    } catch (e) {
        console.error("Format error", fullResponse);
        throw new Error("L'IA n'a pas renvoyé le bon format de données.");
    }
}

function renderQuestion() {
    const container = document.getElementById('defia-active-content');
    const q = gameState.questions[gameState.currentIndex];
    const progress = (gameState.currentIndex / gameState.questions.length) * 100;
    const progressBar = document.getElementById('defia-progress-bar');
    if (progressBar) progressBar.style.width = `${progress}%`;

    if (gameState.mode === 'defi_rapide') startTimer();

    if (gameState.mode === 'paires') {
        renderPairs(q, container);
    } else if (gameState.mode === 'flashcards') {
        renderFlashcard(q, container);
    } else if (gameState.mode === 'intrus') {
        renderIntruder(q, container);
    } else {
        renderQuiz(q, container);
    }
}

function renderQuiz(q, container) {
    container.innerHTML = `
        <div class="question-card" style="width:100%; max-width: 600px; animation: slideIn 0.3s ease-out; padding: 40px; border-radius: 24px; background: var(--surface); border: 2px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            <p class="question-text" style="font-size: 1.5rem; font-weight: 700; margin-bottom: 30px; line-height: 1.4;">${q.question}</p>
            <div class="options-grid" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                ${q.options.map((opt, i) => `
                    <button class="option-btn" style="padding: 18px; border-radius: 12px; font-weight: 600; text-align: left;" onclick="window.submitDefiaAnswer(${i}, this)">${opt}</button>
                `).join('')}
            </div>
            <div id="game-feedback" class="feedback-msg" style="margin-top: 25px; text-align: center; font-size: 1.3rem; font-weight: 800;"></div>
            ${gameState.mode === 'defi_rapide' ? `<div style="margin-top:20px; font-weight:800; color:var(--accent1); text-align: center; font-size: 1.2rem;">⏱️ <span id="game-timer">20</span>s</div>` : ''}
        </div>
    `;
}

function renderIntruder(q, container) {
    container.innerHTML = `
        <div class="question-card" style="width:100%; max-width: 700px; animation: slideIn 0.3s ease-out; padding: 40px; border-radius: 24px; background: var(--surface); border: 2px solid var(--border);">
            <p class="question-text" style="font-size: 1.6rem; font-weight: 700; margin-bottom: 10px; text-align: center;">Trouve l'intrus</p>
            <p style="color: var(--text-muted); text-align: center; margin-bottom: 30px;">L'une de ces affirmations est FAUSSE. Laquelle ?</p>
            <div class="options-grid" style="grid-template-columns: 1fr; gap: 12px;">
                ${q.options.map((opt, i) => `
                    <button class="option-btn" style="text-align: left; padding: 22px; border-radius: 16px; font-weight: 600; line-height: 1.4;" onclick="window.submitDefiaAnswer(${i}, this)">
                        <span style="color: var(--accent5); margin-right: 10px; font-weight: 800;">${['A', 'B', 'C', 'D'][i]}.</span> ${opt}
                    </button>
                `).join('')}
            </div>
            <div id="game-feedback" class="feedback-msg" style="margin-top: 25px; text-align: center; font-size: 1.3rem; font-weight: 800;"></div>
        </div>
    `;
}

function renderPairs(q, container) {
    const lefts = [...q.pairs].sort(() => Math.random() - 0.5);
    const rights = [...q.pairs].sort(() => Math.random() - 0.5);
    
    container.innerHTML = `
        <div class="question-card" style="width:100%; max-width: 800px; animation: slideIn 0.3s ease-out; padding: 40px; border-radius: 24px; background: var(--surface); border: 2px solid var(--border);">
            <p class="question-text" style="text-align: center; margin-bottom: 30px;">Associez les termes correspondants</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div id="pairs-left" style="display: flex; flex-direction: column; gap: 12px;">
                    ${lefts.map(p => `<button class="option-btn p-left" style="padding: 15px; border-radius: 12px; font-size: 0.95rem;" onclick="window.selectPair('left', '${p.left.replace(/'/g, "\\'")}', this)">${p.left}</button>`).join('')}
                </div>
                <div id="pairs-right" style="display: flex; flex-direction: column; gap: 12px;">
                    ${rights.map(p => `<button class="option-btn p-right" style="padding: 15px; border-radius: 12px; font-size: 0.95rem;" onclick="window.selectPair('right', '${p.right.replace(/'/g, "\\'")}', this)">${p.right}</button>`).join('')}
                </div>
            </div>
            <div id="game-feedback" class="feedback-msg" style="margin-top: 25px; text-align: center; font-size: 1.3rem; font-weight: 800;"></div>
        </div>
    `;
    
    let selection = { left: null, right: null, leftEl: null, rightEl: null };
    let matches = 0;

    window.selectPair = (side, val, el) => {
        if (el.classList.contains('correct')) return;
        document.querySelectorAll(`.p-${side}`).forEach(b => { if(!b.classList.contains('correct')) b.style.borderColor = ''; });
        selection[side] = val;
        selection[side + "El"] = el;
        el.style.borderColor = 'var(--accent4)';
        el.style.borderWidth = '3px';

        if (selection.left && selection.right) {
            const pair = q.pairs.find(p => p.left === selection.left);
            if (pair && pair.right === selection.right) {
                selection.leftEl.classList.add('correct');
                selection.rightEl.classList.add('correct');
                selection.leftEl.style.borderWidth = '2px';
                selection.rightEl.style.borderWidth = '2px';
                matches++;
                if (matches === q.pairs.length) {
                    gameState.score += 200;
                    const scoreEl = document.getElementById('defia-score');
                    if (scoreEl) scoreEl.textContent = gameState.score;
                    setTimeout(() => window.nextItem(), 1000);
                }
            } else {
                selection.leftEl.style.borderColor = 'var(--danger-color)';
                selection.rightEl.style.borderColor = 'var(--danger-color)';
                setTimeout(() => {
                    if (!selection.leftEl.classList.contains('correct')) selection.leftEl.style.borderColor = '';
                    if (!selection.rightEl.classList.contains('correct')) selection.rightEl.style.borderColor = '';
                    selection.leftEl.style.borderWidth = '2px';
                    selection.rightEl.style.borderWidth = '2px';
                }, 500);
            }
            selection = { left: null, right: null, leftEl: null, rightEl: null };
        }
    };
}

function renderFlashcard(q, container) {
    container.innerHTML = `
        <div class="question-card" style="width:100%; max-width: 600px; animation: slideIn 0.3s ease-out; padding: 50px; border-radius: 32px; background: var(--surface); border: 2px solid var(--border); text-align: center;">
            <p class="question-text" style="font-size: 2.2rem; font-weight: 800; margin-bottom: 40px; color: var(--accent5);">${q.question}</p>
            <div id="flash-v" style="display:none; background: var(--surface2); padding: 30px; border-radius: 20px; margin-bottom: 30px; border-left: 6px solid var(--accent5); text-align: left; font-size: 1.4rem; line-height: 1.5;">
                <strong style="display: block; margin-bottom: 15px; color: var(--text-muted); font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">Réponse :</strong>
                <div>${q.verso}</div>
            </div>
            <button class="btn btn-primary btn-lg" id="btn-rev" style="width: 100%; height: 60px; border-radius: 16px; font-size: 1.2rem;">Découvrir la réponse</button>
            <div id="flash-acts" style="display:none; gap: 20px; width: 100%;">
                <button class="btn btn-secondary btn-lg" style="flex:1; background: #fee2e2; color: #991b1b; border:none; border-radius: 16px;" onclick="window.nextItem(false)">❌ À revoir</button>
                <button class="btn btn-success btn-lg" style="flex:1; background: #dcfce7; color: #166534; border:none; border-radius: 16px;" onclick="window.nextItem(true)">✅ Je savais</button>
            </div>
        </div>
    `;
    document.getElementById('btn-rev').onclick = () => {
        document.getElementById('flash-v').style.display = 'block';
        document.getElementById('flash-acts').style.display = 'flex';
        document.getElementById('btn-rev').style.display = 'none';
    };
}

function startTimer() {
    if (gameState.timer) clearInterval(gameState.timer);
    gameState.timeLeft = 20;
    const timerEl = document.getElementById('game-timer');
    if (timerEl) timerEl.textContent = gameState.timeLeft;
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        const el = document.getElementById('game-timer');
        if (el) el.textContent = gameState.timeLeft;
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            window.submitDefiaAnswer(-1, null);
        }
    }, 1000);
}

window.submitDefiaAnswer = (index, btn) => {
    if (gameState.timer) clearInterval(gameState.timer);
    const q = gameState.questions[gameState.currentIndex];
    const feedback = document.getElementById('game-feedback');
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);

    if (index === q.answer) {
        if (btn) btn.classList.add('correct');
        gameState.score += 100;
        const scoreEl = document.getElementById('defia-score');
        if (scoreEl) scoreEl.textContent = gameState.score;
        if (feedback) {
            feedback.innerHTML = "✨ EXCELLENT !";
            feedback.style.color = "var(--success-color)";
        }
    } else {
        if (btn) btn.classList.add('wrong');
        if (q.answer !== undefined && allBtns[q.answer]) allBtns[q.answer].classList.add('correct');
        gameState.lives--;
        const livesEl = document.getElementById('defia-lives');
        if (livesEl) livesEl.textContent = gameState.lives;
        if (feedback) {
            feedback.innerHTML = index === -1 ? "⏰ TEMPS ÉCOULÉ !" : "😵 DOMMAGE !";
            feedback.style.color = "var(--danger-color)";
        }
    }

    setTimeout(() => {
        if (gameState.lives <= 0) endGame("GAME OVER !");
        else window.nextItem();
    }, 1800);
};

window.nextItem = (success = true) => {
    if (success && gameState.mode === 'flashcards') {
        gameState.score += 50;
        const scoreEl = document.getElementById('defia-score');
        if (scoreEl) scoreEl.textContent = gameState.score;
    }
    if (gameState.currentIndex >= gameState.questions.length - 1) endGame("DÉFI TERMINÉ !");
    else {
        gameState.currentIndex++;
        renderQuestion();
    }
};

function setupChatMode() {
    const container = document.getElementById('defia-active-content');
    container.innerHTML = `
        <div class="question-card" style="width:100%; max-width: 600px; height: 500px; display: flex; flex-direction: column; padding: 30px; border-radius: 24px; background: var(--surface); border: 2px solid var(--border);">
            <p class="question-text" style="font-size: 1.6rem; font-weight: 800; margin-bottom: 20px; text-align: center;">🧠 Interroge-moi</p>
            <div id="chat-box" style="flex:1; overflow-y: auto; background: var(--surface3); padding: 20px; border-radius: 16px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border);">
                <div style="background: white; padding: 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border: 1px solid var(--border); box-shadow: 0 2px 5px rgba(0,0,0,0.02); line-height: 1.5;">
                    Bonjour ! Je connais parfaitement le cours sur "${selectedTheme}". Pose-moi une question ou demande-moi de te tester.
                </div>
            </div>
            <div style="display: flex; gap: 12px;">
                <input type="text" id="chat-in" class="search-input" placeholder="Pose ta question ici..." style="flex:1; border-radius: 12px; height: 50px; padding-left: 20px;">
                <button class="btn btn-primary" id="chat-go" style="width: 55px; height: 50px; border-radius: 12px; padding: 0;">➤</button>
            </div>
        </div>
    `;
    const box = document.getElementById('chat-box');
    const input = document.getElementById('chat-in');
    const go = document.getElementById('chat-go');
    
    go.onclick = async () => {
        const val = input.value.trim(); if (!val) return;
        box.innerHTML += `<div style="background:var(--accent5); color:white; padding:15px; border-radius:15px; align-self:flex-end; max-width: 85%; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.2); line-height: 1.5;">${val}</div>`;
        input.value = "";
        box.scrollTop = box.scrollHeight;
        const aiMsg = document.createElement('div');
        aiMsg.style = "background:white; padding:15px; border-radius:15px; align-self:flex-start; max-width: 85%; border: 1px solid var(--border); box-shadow: 0 2px 5px rgba(0,0,0,0.02); line-height: 1.5;";
        aiMsg.textContent = "..."; box.appendChild(aiMsg);
        await makeStreamingRequest(`Tu es un tuteur IA expert. Thème: ${selectedTheme}. Cours : ${currentLessonContent}\n\nÉlève : ${val}`, { tool: 'professor' }, (c, f) => { aiMsg.textContent = f; box.scrollTop = box.scrollHeight; }, () => {}, (err) => console.error(err));
    };
    input.onkeypress = (e) => { if(e.key === 'Enter') go.click(); };
}

function endGame(msg) {
    const container = document.getElementById('defia-active-content');
    container.innerHTML = `
        <div class="question-card" style="text-align: center; padding: 60px; border-radius: 32px; background: var(--surface); border: 2px solid var(--border); box-shadow: 0 15px 40px rgba(0,0,0,0.1); animation: modalSlideUp 0.5s ease;">
            <div style="font-size: 6rem; margin-bottom: 25px;">🏁</div>
            <h2 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 15px; color: var(--accent5);">${msg}</h2>
            <p style="font-size: 1.3rem; color: var(--text-muted); margin-bottom: 40px;">Score final : <span style="color: var(--text); font-weight: 800;">${gameState.score}</span> pts</p>
            <button class="btn btn-primary btn-lg" style="padding: 15px 40px; border-radius: 16px; font-size: 1.2rem; font-weight: 700;" onclick="window.showModeSelection()">Rejouer une mission</button>
        </div>
    `;
}
