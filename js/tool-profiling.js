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

    // Export Profile JSON
    const exportProfileJsonBtn = document.getElementById('exportProfileJsonBtn');
    exportProfileJsonBtn?.addEventListener('click', () => {
        const profileRaw = localStorage.getItem('student_profile');
        if (!profileRaw) {
            window.showToast("Veuillez d'abord calculer votre profil.");
            return;
        }
        const blob = new Blob([profileRaw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `profil_etudiant_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showToast("Profil Étudiant exporté en .json ! 📥");
    });

    // Copy code logic
    copyCuaCodeBtn?.addEventListener('click', () => {
        const codeText = generatedCuaCode?.textContent;
        if (codeText) {
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    window.showToast("Code de profil copié ! ✓");
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

        window.showToast("Profil Étudiant activé avec succès dans votre espace ! ✨");

        // Redirect student
        const tabEl = document.querySelector('.tab-link[data-tab="student"]');
        if (tabEl) {
            tabEl.click();
        } else {
            const homeTab = document.querySelector('.tab-link[data-tab="home"]');
            homeTab?.click();
        }
    });

    function calculateCuaProfile() {
        const values = [];
        const finalAnswers = {};
        for (let i = 1; i <= totalSteps; i++) {
            const ans = getAnswerForStep(i) || 'A';
            values.push(ans);
            finalAnswers[`q${i}`] = ans;
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
            profileText = "🧠 Profil Autonomie & Flexibilité. Ajustements légers de confort visuel et méthodologique.";
        } else if (majority === 'B') {
            profileText = "🎨 Profil Soutien Méthodologique & Visuel. Aménagements de temps, aération des textes et guidage pas-à-pas.";
        } else if (majority === 'C') {
            profileText = "🗺️ Profil Adaptation Renforcée. Simplification textuelle (FALC), soutien audio et structuration séquentielle indispensables.";
        } else {
            profileText = "🤝 Profil Compensation & Multimodalité Maximale. Recours prioritaire à la CAA (pictogrammes), synthèse vocale immersive et découpage guidé.";
        }

        if (resultProfileText) resultProfileText.textContent = profileText;

        // Generate Code: ETUDIANT-A-B-C-A-B-C-A-A-B-D
        const code = `ETUDIANT-${values.join('-')}`;
        if (generatedCuaCode) generatedCuaCode.textContent = code;

        // Calculate Recommended Modules
        const recommendedModules = [];
        const qReading = values[0];
        const qSize = values[1];
        const qLayout = values[2];
        const qAudio = values[4];
        const qOrga = values[5];
        const qWrite = values[7];
        const qVisual = values[9];

        // 1. Reading & Dyslexia & FALC
        if (qReading === 'C' || qReading === 'D' || qSize === 'C' || qSize === 'D') {
            recommendedModules.push({ id: 'falc', label: '✍️ Simplification FALC', desc: 'Phrases courtes et claires' });
            recommendedModules.push({ id: 'dyslexie', label: '📖 Module Dyslexie', desc: 'Police DYS et aération' });
            recommendedModules.push({ id: 'aide-lecture', label: '📚 Aide à la lecture', desc: 'Lexique et résumé guidé' });
        }

        // 2. Audio & Speech
        if (qAudio === 'C' || qAudio === 'D' || qReading === 'D') {
            recommendedModules.push({ id: 'voice', label: '🎙️ Synthèse vocale immersive', desc: 'Lecture audio mot-à-mot' });
        }

        // 3. Organization & Step-by-Step & TEACCH
        if (qOrga === 'C' || qOrga === 'D' || qLayout === 'C' || qLayout === 'D') {
            recommendedModules.push({ id: 'sequentiel', label: '🧩 Séquentiel (TEACCH)', desc: 'Routines étape par étape' });
            recommendedModules.push({ id: 'todo', label: '📋 Pas-à-Pas (Tâches)', desc: 'Décomposition de consignes' });
            recommendedModules.push({ id: 'expliciter', label: '💡 Expliciter la tâche', desc: 'Lever les implicites' });
        }

        // 4. Writing & Motor Fatigue
        if (qWrite === 'C' || qWrite === 'D') {
            recommendedModules.push({ id: 'handicap-moteur', label: '✍️ Formats cochants', desc: 'Soulagement de la saisie' });
            recommendedModules.push({ id: 'mic', label: '🎤 Dictée Vocale', desc: 'Saisie sans clavier' });
        }

        // 5. Visual & CAA Pictograms
        if (qReading === 'D' || qWrite === 'D') {
            recommendedModules.push({ id: 'caa', label: '🖼️ Pictogrammes ARASAAC', desc: 'Bandes-phrases visuelles' });
            recommendedModules.push({ id: 'tableau-communication', label: '💬 Grille CAA', desc: 'Communication thématique' });
        }

        // 6. Visual contrast
        if (qVisual === 'D') {
            recommendedModules.push({ id: 'deficience-visuelle', label: '👁️ Fort contraste & Luciole', desc: 'Confort visuel maximal' });
        }

        // Fallback default modules
        if (recommendedModules.length === 0) {
            recommendedModules.push({ id: 'expliciter', label: '💡 Explicitation CUA', desc: 'Clarté cognitive' });
            recommendedModules.push({ id: 'todo', label: '📋 Pas-à-Pas', desc: 'Méthodologie' });
            recommendedModules.push({ id: 'professor', label: '💡 Clarificateur', desc: 'Multi-angles' });
        }

        // Populate badges in UI
        const badgesContainer = document.getElementById('recommendedModulesBadges');
        if (badgesContainer) {
            badgesContainer.innerHTML = '';
            recommendedModules.forEach(mod => {
                const span = document.createElement('span');
                span.className = 'stag';
                span.style.background = 'rgba(124, 58, 237, 0.12)';
                span.style.borderColor = 'rgba(124, 58, 237, 0.3)';
                span.style.color = 'var(--text)';
                span.style.padding = '6px 12px';
                span.style.borderRadius = '20px';
                span.style.fontSize = '0.85rem';
                span.style.fontWeight = '500';
                span.title = mod.desc;
                span.textContent = mod.label;
                badgesContainer.appendChild(span);
            });
        }

        // Preferences list
        if (cuaPreferencesList) {
            cuaPreferencesList.innerHTML = '';
            
            const sizeOption = values[1];
            let sizePref = "Taille standard (16px)";
            if (sizeOption === 'B') sizePref = "Texte légèrement agrandi (18px)";
            else if (sizeOption === 'C') sizePref = "Texte agrandi (22px)";
            else if (sizeOption === 'D') sizePref = "Grand format (26px) et synthèse vocale";
            
            const layoutOption = values[2];
            let layoutPref = "Mise en page standard";
            if (layoutOption === 'B') layoutPref = "Mise en page aérée (double interligne)";
            else if (layoutOption === 'C') layoutPref = "Consignes segmentées en micro-blocs";
            else if (layoutOption === 'D') layoutPref = "Mise en page épurée (style FALC)";

            const writeOption = values[7];
            let writePref = "Saisie standard";
            if (writeOption === 'B') writePref = "Soulagement de l'écrit (manuscrits courts)";
            if (writeOption === 'C') writePref = "Réponses par cases à cocher / QCM";
            if (writeOption === 'D') writePref = "Dictée vocale et réponses audio";

            const prefs = [sizePref, layoutPref, writePref];
            
            if (qReading === 'C' || qReading === 'D' || sizeOption === 'C') {
                prefs.push("Police inclusive OpenDyslexic activée");
            }
            if (qAudio === 'C' || qAudio === 'D') {
                prefs.push("Lecteur vocal et synthèse de consignes activés");
            }
            if (qVisual === 'D') {
                prefs.push("Contraste élevé et repérage visuel renforcé");
            }

            prefs.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                cuaPreferencesList.appendChild(li);
            });
        }

        // Save complete Student Profile to LocalStorage
        const isDys = (qReading === 'C' || qReading === 'D' || qSize === 'C');
        const studentProfile = {
            code: code,
            level: majority,
            answers: finalAnswers,
            recommendedModules: recommendedModules.map(m => m.id),
            typography: {
                font: isDys ? 'OpenDyslexic' : 'default',
                size: values[1],
                spacing: values[2] === 'B' || values[2] === 'C' ? '1.5' : 'normal'
            },
            needsAudio: (qAudio === 'C' || qAudio === 'D' || qReading === 'D'),
            needsFalc: (qReading === 'C' || qReading === 'D'),
            needsPictos: (qReading === 'D' || qWrite === 'D'),
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem('student_profile', JSON.stringify(studentProfile));
        localStorage.setItem('cua_profile_code', code);
        localStorage.setItem('cua_profile_answers', JSON.stringify(finalAnswers));

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
