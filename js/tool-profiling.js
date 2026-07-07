export function initProfiling() {
    const currentStepNum = document.getElementById('currentStepNum');
    const progressPercent = document.getElementById('progressPercent');
    const progressFill = document.getElementById('progressFill');
    const prevStepBtn = document.getElementById('prevStepBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const profilingCard = document.getElementById('profilingCard');
    const profilingResultCard = document.getElementById('profilingResultCard');
    const resultProfileText = document.getElementById('resultProfileText');
    const generatedCuaCode = document.getElementById('generatedCuaCode');
    const copyCuaCodeBtn = document.getElementById('copyCuaCodeBtn');
    const applyProfileBtn = document.getElementById('applyProfileBtn');
    const cuaPreferencesList = document.getElementById('cuaPreferencesList');

    if (!profilingCard || !nextStepBtn || !prevStepBtn) {
        console.warn("Profiling CUA DOM elements not found, skipping.");
        return;
    }

    let currentStep = 1;
    const totalSteps = 10;
    const answers = {};

    // Step navigation
    function showStep(step) {
        currentStep = step;
        
        // Update active class on steps
        const steps = profilingCard.querySelectorAll('.profiling-step');
        steps.forEach(s => {
            const sNum = parseInt(s.dataset.step);
            if (sNum === step) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });

        // Update progress bar
        const percent = Math.round((step / totalSteps) * 100);
        if (currentStepNum) currentStepNum.textContent = step;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressFill) progressFill.style.width = `${percent}%`;

        // Update nav buttons
        if (prevStepBtn) prevStepBtn.disabled = step === 1;
        
        // Enable next only if active question has an answer
        validateNextButton();

        if (nextStepBtn) {
            nextStepBtn.textContent = step === totalSteps ? 'Terminer 🏁' : 'Suivant ➡';
        }
    }

    function validateNextButton() {
        const val = getAnswerForStep(currentStep);
        if (nextStepBtn) {
            nextStepBtn.disabled = !val;
        }
    }

    function getAnswerForStep(step) {
        const radio = profilingCard.querySelector(`.profiling-step[data-step="${step}"] input[name="q${step}"]:checked`);
        return radio ? radio.value : null;
    }

    // Step 1: Reading test logic
    const startReadingBtn = document.getElementById('startReadingBtn');
    const stopReadingBtn = document.getElementById('stopReadingBtn');
    const readingTextBox = document.getElementById('readingTextBox');
    const readingResultMsg = document.getElementById('readingResultMsg');
    let readingStartTime = null;

    startReadingBtn?.addEventListener('click', () => {
        startReadingBtn.style.display = 'none';
        if (readingTextBox) readingTextBox.style.display = 'block';
        if (stopReadingBtn) stopReadingBtn.style.display = 'inline-flex';
        readingStartTime = Date.now();
    });

    stopReadingBtn?.addEventListener('click', () => {
        if (stopReadingBtn) stopReadingBtn.style.display = 'none';
        if (readingResultMsg) readingResultMsg.style.display = 'block';
        
        const durationSec = (Date.now() - readingStartTime) / 1000;
        const wordCount = 45; // Count of words in reading text
        const wpm = Math.round((wordCount / durationSec) * 60);
        
        let option = 'A';
        let speedText = 'rapide';
        
        if (wpm < 50) {
            option = 'D';
            speedText = 'très lente';
        } else if (wpm < 90) {
            option = 'C';
            speedText = 'lente';
        } else if (wpm < 130) {
            option = 'B';
            speedText = 'modérée';
        }

        // Set radio button automatically
        const radio = profilingCard.querySelector(`input[name="q1"][value="${option}"]`);
        if (radio) {
            radio.checked = true;
            // Highlight selected option-card
            const cards = profilingCard.querySelectorAll('#options-q1 .option-card');
            cards.forEach(c => c.classList.remove('selected'));
            radio.closest('.option-card')?.classList.add('selected');
        }

        readingResultMsg.innerHTML = `⏱️ Vitesse mesurée : <strong>${wpm} mots/minute</strong> (${durationSec.toFixed(1)}s).<br>L'option <strong>${option}</strong> a été présélectionnée. Vous pouvez la modifier ci-dessous.`;
        validateNextButton();
    });

    // Step 2: Font size logic
    const decreaseSizeBtn = document.getElementById('decreaseSizeBtn');
    const increaseSizeBtn = document.getElementById('increaseSizeBtn');
    const fontSizeBadge = document.getElementById('fontSizeBadge');
    const textSizePreview = document.getElementById('textSizePreview');
    let activeSizePx = 16;

    function setPreviewSize(size) {
        activeSizePx = size;
        if (fontSizeBadge) fontSizeBadge.textContent = `${size}px`;
        if (textSizePreview) textSizePreview.style.fontSize = `${size}px`;

        let option = 'A';
        if (size >= 25) option = 'D';
        else if (size >= 21) option = 'C';
        else if (size >= 18) option = 'B';

        const radio = profilingCard.querySelector(`input[name="q2"][value="${option}"]`);
        if (radio) {
            radio.checked = true;
            const cards = profilingCard.querySelectorAll('#options-q2 .option-card');
            cards.forEach(c => c.classList.remove('selected'));
            radio.closest('.option-card')?.classList.add('selected');
        }
        validateNextButton();
    }

    decreaseSizeBtn?.addEventListener('click', () => {
        if (activeSizePx > 12) setPreviewSize(activeSizePx - 2);
    });

    increaseSizeBtn?.addEventListener('click', () => {
        if (activeSizePx < 28) setPreviewSize(activeSizePx + 2);
    });

    // Step 3: Layout choice cards
    const layoutCards = profilingCard.querySelectorAll('.layout-preview-card');
    layoutCards.forEach(card => {
        card.addEventListener('click', () => {
            layoutCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const val = card.getAttribute('data-val');
            const radio = profilingCard.querySelector(`input[name="q3"][value="${val}"]`);
            if (radio) {
                radio.checked = true;
            }
            validateNextButton();
        });
    });

    // Step 5: TTS audio test
    const playConsigneSpeech = document.getElementById('playConsigneSpeech');
    const audioTestStatus = document.getElementById('audioTestStatus');
    const speechTextToRead = document.getElementById('speechTextToRead');

    playConsigneSpeech?.addEventListener('click', () => {
        if (!window.speechSynthesis) {
            alert("La synthèse vocale n'est pas supportée par votre navigateur.");
            return;
        }
        window.speechSynthesis.cancel();
        const text = speechTextToRead?.textContent || "Consigne de test";
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';

        utterance.onstart = () => {
            if (audioTestStatus) audioTestStatus.textContent = "🔊 Lecture vocale en cours...";
            playConsigneSpeech.classList.add('playing');
        };

        utterance.onend = () => {
            if (audioTestStatus) audioTestStatus.textContent = "✅ Test d'écoute terminé !";
            playConsigneSpeech.classList.remove('playing');
        };

        const voices = window.speechSynthesis.getVoices();
        const frVoice = voices.find(v => v.lang.startsWith('fr') || v.lang.startsWith('FR'));
        if (frVoice) utterance.voice = frVoice;

        window.speechSynthesis.speak(utterance);
    });

    // Step 10: Theme choice cards
    const themeCards = profilingCard.querySelectorAll('.theme-sample-card');
    themeCards.forEach(card => {
        card.addEventListener('click', () => {
            themeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const val = card.getAttribute('data-val');
            const radio = profilingCard.querySelector(`input[name="q10"][value="${val}"]`);
            if (radio) {
                radio.checked = true;
            }
            validateNextButton();
        });
    });

    // Handle normal option grids selection style
    profilingCard.querySelectorAll('.options-grid .option-card input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // Unhighlight siblings
            const stepEl = radio.closest('.profiling-step');
            if (stepEl) {
                stepEl.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                radio.closest('.option-card')?.classList.add('selected');
            }
            validateNextButton();
        });
    });

    // Nav buttons clicks
    prevStepBtn?.addEventListener('click', () => {
        if (currentStep > 1) showStep(currentStep - 1);
    });

    nextStepBtn?.addEventListener('click', () => {
        const answer = getAnswerForStep(currentStep);
        if (!answer) return;

        answers[`q${currentStep}`] = answer;

        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        } else {
            calculateCuaProfile();
        }
    });

    // Copy code logic
    copyCuaCodeBtn?.addEventListener('click', () => {
        const codeText = generatedCuaCode?.textContent;
        if (codeText) {
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    window.showToast("Code d'adaptation copié ! ✓");
                })
                .catch(err => {
                    console.error("Copy failed:", err);
                });
        }
    });

    // Apply profile
    applyProfileBtn?.addEventListener('click', () => {
        const code = generatedCuaCode?.textContent || '';
        if (!code) return;

        // Store profile details
        const finalAnswers = {};
        for (let i = 1; i <= totalSteps; i++) {
            finalAnswers[`q${i}`] = getAnswerForStep(i);
        }

        // Apply rules in student window
        localStorage.setItem('cua_profile_code', code);
        localStorage.setItem('cua_profile_answers', JSON.stringify(finalAnswers));

        window.showToast("Profil d'adaptation appliqué avec succès ! ✓");

        // Redirect student
        const tabEl = document.querySelector('.tab-link[data-tab="student"]');
        if (tabEl) {
            tabEl.click();
        } else {
            // Fallback: reload home
            const homeTab = document.querySelector('.tab-link[data-tab="home"]');
            homeTab?.click();
        }
    });

    function calculateCuaProfile() {
        const values = [];
        for (let i = 1; i <= totalSteps; i++) {
            values.push(getAnswerForStep(i) || 'A');
        }

        // Frequency count
        const counts = { A: 0, B: 0, C: 0, D: 0 };
        values.forEach(v => counts[v]++);

        // Find majority with hierarchy fallback D > C > B > A
        let majority = 'A';
        let maxCount = counts.A;

        if (counts.B >= maxCount) { majority = 'B'; maxCount = counts.B; }
        if (counts.C >= maxCount) { majority = 'C'; maxCount = counts.C; }
        if (counts.D >= maxCount) { majority = 'D'; maxCount = counts.D; }

        let profileText = "";
        if (majority === 'A') {
            profileText = "🧠 Profil d'adaptation légère. Vigilance et ajustements légers recommandés.";
        } else if (majority === 'B') {
            profileText = "🎨 Profil d'adaptation modérée. Aménagements de temps et de présentation utiles.";
        } else if (majority === 'C') {
            profileText = "🗺️ Profil d'adaptation forte. Allègements, simplifications textuelles et guidage visuel requis.";
        } else {
            profileText = "🤝 Profil d'adaptation individualisée. Simplification maximale (FALC), aide audio ou humaine recommandée.";
        }

        if (resultProfileText) resultProfileText.textContent = profileText;

        // Generate Code: CUA-A-B-C-A-B-C-A-A-B-D
        const code = `CUA-${values.join('-')}`;
        if (generatedCuaCode) generatedCuaCode.textContent = code;

        // Create detail recommendations
        if (cuaPreferencesList) {
            cuaPreferencesList.innerHTML = '';
            
            // FontSize preference
            const sizeOption = values[1]; // q2
            let sizePref = "Taille standard";
            if (sizeOption === 'B') sizePref = "Texte légèrement agrandi";
            else if (sizeOption === 'C') sizePref = "Texte très agrandi";
            else if (sizeOption === 'D') sizePref = "Écran à fort grossissement ou lecture vocale";
            
            // Layout preference
            const layoutOption = values[2]; // q3
            let layoutPref = "Mise en page classique";
            if (layoutOption === 'B') layoutPref = "Mise en page aérée (double interligne)";
            else if (layoutOption === 'C') layoutPref = "Consignes segmentées (une consigne par bloc)";
            else if (layoutOption === 'D') layoutPref = "Mise en page minimale simplifiée";

            // Writing preference
            const writeOption = values[7]; // q8
            let writePref = "Saisie manuscrite standard";
            if (writeOption === 'B') writePref = "Soulagement de l'écrit (manuscrits courts)";
            if (writeOption === 'C') writePref = "Rendre les réponses sous forme de cases à cocher/QCM";
            if (writeOption === 'D') writePref = "Dictée vocale ou clavier numérique";

            // Add to bullet points
            const prefs = [sizePref, layoutPref, writePref];
            
            // Check dyslexia
            const readingOption = values[0]; // q1
            if (readingOption === 'C' || readingOption === 'D' || sizeOption === 'C') {
                prefs.push("Police d'écriture inclusive / Dyslexie (OpenDyslexic) active");
            }
            if (values[4] === 'C' || values[4] === 'D') { // q5
                prefs.push("Audio et synthèse vocale activés pour les consignes");
            }
            if (values[9] === 'D') { // q10
                prefs.push("Contraste élevé et couleurs de repérage visuel");
            }

            prefs.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                cuaPreferencesList.appendChild(li);
            });
        }

        // Switch to result view
        if (profilingCard) profilingCard.style.display = 'none';
        const progressWrapper = document.querySelector('.profiling-progress-wrapper');
        if (progressWrapper) progressWrapper.style.display = 'none';
        const navBtns = document.querySelector('.profiling-nav-btns');
        if (navBtns) navBtns.style.display = 'none';
        if (profilingResultCard) profilingResultCard.style.display = 'block';
    }

    // Set initial state
    showStep(1);
}
