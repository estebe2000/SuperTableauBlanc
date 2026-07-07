import { makeStreamingRequest } from './api.js';

export function initStudent() {
    const studentJoinContainer = document.getElementById('studentJoinContainer');
    const studentSessionCode = document.getElementById('studentSessionCode');
    const studentJoinBtn = document.getElementById('studentJoinBtn');
    const studentActiveContainer = document.getElementById('studentActiveContainer');
    const sessionStatusText = document.getElementById('sessionStatusText');
    const cuaAppliedCodeText = document.getElementById('cuaAppliedCodeText');
    const openCuaSettingsBtn = document.getElementById('openCuaSettingsBtn');
    const studentDesktop = document.getElementById('studentDesktop');
    const studentDesktopPlaceholder = document.getElementById('studentDesktopPlaceholder');
    const studentCanvasOverlay = document.getElementById('studentCanvasOverlay');
    
    // Subtitle variables
    const studentSubtitlesBanner = document.getElementById('studentSubtitlesBanner');
    const subtitleTextContent = document.getElementById('subtitleTextContent');
    const subtitleTextLoader = document.getElementById('subtitleTextLoader');
    const subtitleLangSelect = document.getElementById('subtitleLangSelect');
    const decreaseSubSize = document.getElementById('decreaseSubSize');
    const increaseSubSize = document.getElementById('increaseSubSize');
    const speakSubtitlesBtn = document.getElementById('speakSubtitlesBtn');

    // Docs variables
    const studentDocsPanel = document.getElementById('studentDocsPanel');
    const studentDocsList = document.getElementById('studentDocsList');
    const studentAdaptDocBtn = document.getElementById('studentAdaptDocBtn');
    const studentDocViewer = document.getElementById('studentDocViewer');
    const closeStudentViewerBtn = document.getElementById('closeStudentViewerBtn');
    const studentViewerTitle = document.getElementById('studentViewerTitle');
    const studentViewerContent = document.getElementById('studentViewerContent');

    // Modal variables
    const cuaSettingsModal = document.getElementById('cuaSettingsModal');
    const closeCuaModalBtn = document.getElementById('closeCuaModalBtn');
    const cuaModalCloseArea = document.getElementById('cuaModalCloseArea');
    const cuaCodeInput = document.getElementById('cuaCodeInput');
    const applyCuaCodeBtn = document.getElementById('applyCuaCodeBtn');
    const launchProfilingFromModalBtn = document.getElementById('launchProfilingFromModalBtn');

    if (!studentJoinContainer || !studentJoinBtn || !studentActiveContainer) {
        console.warn("Student view DOM elements not found, skipping.");
        return;
    }

    let socket = null;
    let sessionCode = "";
    let originalTranscript = "";
    let activeCuaCode = "";
    let activeCuaPrefs = {};
    let subFontSizePx = 18;
    let sharedDocs = [];
    let currentViewingDoc = null;

    // Check URL parameters for direct link (e.g. ?session=123456 or ?tab=student&session=123456)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionUrl = urlParams.get('session');
    if (sessionUrl) {
        studentSessionCode.value = sessionUrl.replace('-', '');
        // Auto connect on next tick after app initializations
        setTimeout(() => {
            studentJoinBtn.click();
        }, 100);
    }

    // Load stored CUA code if exists
    const storedCode = localStorage.getItem('cua_profile_code');
    if (storedCode) {
        activeCuaCode = storedCode;
        if (cuaCodeInput) cuaCodeInput.value = storedCode;
        applyCuaProfile(storedCode);
    }

    // Modal access
    openCuaSettingsBtn?.addEventListener('click', () => {
        if (cuaSettingsModal) cuaSettingsModal.classList.add('show');
    });

    const closeModal = () => {
        if (cuaSettingsModal) cuaSettingsModal.classList.remove('show');
    };
    closeCuaModalBtn?.addEventListener('click', closeModal);
    cuaModalCloseArea?.addEventListener('click', closeModal);

    launchProfilingFromModalBtn?.addEventListener('click', () => {
        closeModal();
        // Redirect to profiling tab
        const pTab = document.querySelector('.tab-link[data-tab="profiling"]');
        pTab?.click();
    });

    applyCuaCodeBtn?.addEventListener('click', () => {
        const code = cuaCodeInput.value.trim().toUpperCase();
        if (!code.startsWith('CUA-')) {
            alert("Code invalide. Le code doit commencer par 'CUA-'.");
            return;
        }
        activeCuaCode = code;
        localStorage.setItem('cua_profile_code', code);
        applyCuaProfile(code);
        closeModal();
        window.showToast("Profil d'accessibilité mis à jour ! ✓");
    });

    // Subtitle font controls
    increaseSubSize?.addEventListener('click', () => {
        subFontSizePx = Math.min(subFontSizePx + 2, 32);
        if (subtitleTextContent) subtitleTextContent.style.fontSize = `${subFontSizePx}px`;
    });

    decreaseSubSize?.addEventListener('click', () => {
        subFontSizePx = Math.max(subFontSizePx - 2, 12);
        if (subtitleTextContent) subtitleTextContent.style.fontSize = `${subFontSizePx}px`;
    });

    // TTS speaker for subtitles
    speakSubtitlesBtn?.addEventListener('click', () => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        
        const text = subtitleTextContent?.textContent || "";
        if (!text || text.startsWith("En attente")) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = subtitleLangSelect.value === 'fr' || subtitleLangSelect.value === 'simplifie' ? 'fr-FR' : 
                         subtitleLangSelect.value === 'en' ? 'en-US' : 
                         subtitleLangSelect.value === 'es' ? 'es-ES' : 'ar-SA';
        
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(v => v.lang.startsWith(utterance.lang.substring(0, 2)));
        if (matchedVoice) utterance.voice = matchedVoice;

        window.speechSynthesis.speak(utterance);
    });

    // Dropdown change for live subtitles translations
    subtitleLangSelect?.addEventListener('change', () => {
        processSubtitleTranslation(originalTranscript);
    });

    // Join room logic
    studentJoinBtn.addEventListener('click', () => {
        const rawCode = studentSessionCode.value.trim();
        if (rawCode.length < 5) {
            alert("Veuillez entrer un code de session valide.");
            return;
        }

        sessionCode = rawCode.replace('-', '');
        sessionStatusText.textContent = "Connexion en cours...";
        studentJoinBtn.disabled = true;
        studentJoinBtn.textContent = "Connexion... ⏳";

        // Establish WS
        connectWebSocket();
    });

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        try {
            socket = new WebSocket(wsUrl);
            
            socket.onopen = () => {
                console.log("[Student] Socket connected");
                socket.send(JSON.stringify({
                    type: 'join',
                    session: sessionCode,
                    role: 'student'
                }));
                
                // Switch interface views
                studentJoinContainer.style.display = 'none';
                studentActiveContainer.style.display = 'flex';
                sessionStatusText.textContent = `Connecté à la classe (Code : ${sessionCode})`;
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'sync-desktop') {
                    renderDesktopWidgets(data.widgets);
                } else if (data.type === 'sync-background') {
                    applyDesktopBackground(data.background);
                } else if (data.type === 'sync-transcript') {
                    handleLiveTranscript(data.text, data.isFinal);
                } else if (data.type === 'sync-document') {
                    addSharedDocument(data.document);
                }
            };

            socket.onclose = () => {
                console.log("[Student] Socket disconnected");
                sessionStatusText.textContent = "⚠️ Déconnecté de la session. Tentative de reconnexion...";
                // Try auto-reconnect after 3 seconds
                setTimeout(() => {
                    if (studentActiveContainer.style.display === 'flex') connectWebSocket();
                }, 3000);
            };

            socket.onerror = (err) => {
                console.error("[Student] WebSocket error:", err);
                sessionStatusText.textContent = "❌ Erreur de connexion.";
                studentJoinBtn.disabled = false;
                studentJoinBtn.textContent = "Se connecter au cours 🖥️";
            };

        } catch (e) {
            console.error("Failed to establish WS:", e);
            alert("Erreur de connexion WebSocket.");
            studentJoinBtn.disabled = false;
            studentJoinBtn.textContent = "Se connecter au cours 🖥️";
        }
    }

    // Render widgets dispatched by teacher
    function renderDesktopWidgets(widgets) {
        if (!widgets || widgets.length === 0) {
            studentDesktopPlaceholder.style.display = 'flex';
            // Remove existing widgets
            studentDesktop.querySelectorAll('.widget-instance').forEach(w => w.remove());
            clearCanvas();
            return;
        }

        studentDesktopPlaceholder.style.display = 'none';
        
        // Remove existing widgets not present anymore
        const widgetIds = widgets.map(w => w.id);
        studentDesktop.querySelectorAll('.widget-instance').forEach(w => {
            if (!widgetIds.includes(w.id)) w.remove();
        });

        // Render or update each widget
        widgets.forEach(w => {
            if (w.type === 'drawing-data') {
                drawOnCanvas(w.data);
                return;
            }

            let wEl = document.getElementById(`stud-w-${w.id}`);
            if (!wEl) {
                wEl = document.createElement('div');
                wEl.id = `stud-w-${w.id}`;
                wEl.className = `widget-instance widget-${w.type}`;
                studentDesktop.appendChild(wEl);
            }

            // Sync position (coordinates are in percentage of desktop width/height to be responsive)
            wEl.style.left = `${w.x}%`;
            wEl.style.top = `${w.y}%`;
            if (w.width) wEl.style.width = typeof w.width === 'number' ? `${w.width}px` : w.width;
            if (w.height) wEl.style.height = typeof w.height === 'number' ? `${w.height}px` : w.height;
            if (w.color) wEl.style.borderColor = w.color;
            if (w.bgColor) wEl.style.backgroundColor = w.bgColor;

            // Render widget inner content based on type
            renderWidgetContent(wEl, w);
        });
    }

    function renderWidgetContent(el, w) {
        if (w.type === 'postit') {
            el.innerHTML = `<div class="postit-content">${w.content || ""}</div>`;
        } else if (w.type === 'text') {
            el.innerHTML = `<div class="text-content">${w.content || ""}</div>`;
        } else if (w.type === 'qrcode') {
            el.innerHTML = `<div class="qrcode-content"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(w.content)}" alt="QR Code"><p class="qr-label">${w.content}</p></div>`;
        } else if (w.type === 'timer') {
            // Draw interactive countdown timer
            const secondsLeft = w.secondsLeft || 0;
            const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
            const secs = (secondsLeft % 60).toString().padStart(2, '0');
            
            el.className = `widget-instance widget-timer ${secondsLeft === 0 ? 'timer-finished' : ''}`;
            el.innerHTML = `
                <div class="timer-clock">⏱️ ${mins}:${secs}</div>
                <div class="timer-label">${w.content || 'Minuteur'}</div>
            `;
        } else if (w.type === 'video') {
            const url = w.content || "";
            if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
                el.innerHTML = `<iframe src="${url}" frameborder="0" allowfullscreen style="width:100%; height:100%;"></iframe>`;
            } else {
                el.innerHTML = `<video src="${url}" controls style="max-width:100%; max-height:100%;"></video>`;
            }
        } else if (w.type === 'iframe') {
            el.innerHTML = `<iframe src="${w.content}" frameborder="0" style="width:100%; height:100%;"></iframe>`;
        } else if (w.type === 'file') {
            el.innerHTML = `
                <div class="file-widget-inner">
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                        <span class="file-name" title="${w.content}">${w.content}</span>
                        <span class="file-desc">Fichier partagé par le prof</span>
                    </div>
                </div>
            `;
        }
    }

    function applyDesktopBackground(bg) {
        if (!studentDesktop) return;
        studentDesktop.style.backgroundImage = 'none';
        studentDesktop.style.backgroundColor = 'var(--surface)';

        if (bg === 'blackboard') {
            studentDesktop.style.backgroundColor = '#162e20'; // chalkboard green
            studentDesktop.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(25,60,35,0.8) 0%, rgba(10,30,15,1) 100%)';
        } else if (bg === 'grid') {
            studentDesktop.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)';
            studentDesktop.style.backgroundSize = '20px 20px';
        } else if (bg === 'seyes') {
            studentDesktop.style.backgroundImage = 'linear-gradient(#e6f0fa 1px, transparent 1px), linear-gradient(90deg, #e6f0fa 1px, transparent 1px)';
            studentDesktop.style.backgroundSize = '10px 10px';
        } else if (bg === 'white') {
            studentDesktop.style.backgroundColor = '#ffffff';
        } else {
            // Default background
            studentDesktop.style.backgroundColor = 'var(--bg)';
        }
    }

    // Canvas drawing recreation from teacher
    function drawOnCanvas(drawData) {
        const canvas = studentCanvasOverlay;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize overlay to desktop size
        if (canvas.width !== studentDesktop.clientWidth || canvas.height !== studentDesktop.clientHeight) {
            canvas.width = studentDesktop.clientWidth;
            canvas.height = studentDesktop.clientHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!drawData || drawData.length === 0) return;

        drawData.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 2) return;
            
            ctx.beginPath();
            ctx.strokeStyle = stroke.color || '#ff0000';
            ctx.lineWidth = stroke.width || 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Points coordinates are percentages of desktop size, convert back to absolute pixels
            const startX = (stroke.points[0].x / 100) * canvas.width;
            const startY = (stroke.points[0].y / 100) * canvas.height;
            ctx.moveTo(startX, startY);
            
            for (let i = 1; i < stroke.points.length; i++) {
                const px = (stroke.points[i].x / 100) * canvas.width;
                const py = (stroke.points[i].y / 100) * canvas.height;
                ctx.lineTo(px, py);
            }
            ctx.stroke();
        });
    }

    function clearCanvas() {
        const canvas = studentCanvasOverlay;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Handle live audio transcripts from teacher
    function handleLiveTranscript(text, isFinal) {
        originalTranscript = text;

        if (isFinal) {
            if (subtitleTextLoader) subtitleTextLoader.style.display = 'none';
            // Finalize sentence and translate/simplify if selected
            processSubtitleTranslation(text);
        } else {
            // Live typing feedback, show loader
            if (subtitleTextLoader) subtitleTextLoader.style.display = 'inline-flex';
            
            const selectedLang = subtitleLangSelect.value;
            if (selectedLang === 'fr') {
                if (subtitleTextContent) subtitleTextContent.textContent = text;
            } else {
                // For non-FR translated live typing, show French text in gray/italic to maintain real-time feel,
                // translation will overwrite once sentence is final.
                if (subtitleTextContent) subtitleTextContent.innerHTML = `<span style="font-style: italic; opacity: 0.6;">(En cours...) ${text}</span>`;
            }
        }
    }

    // Run translation on completed chunks using Albert API
    let translationCache = {}; // Cache to avoid duplicate API calls
    async function processSubtitleTranslation(text) {
        if (!text || text.trim() === "") {
            if (subtitleTextContent) subtitleTextContent.textContent = "En attente de parole de l'enseignant...";
            return;
        }

        const mode = subtitleLangSelect.value;
        if (mode === 'fr') {
            if (subtitleTextContent) subtitleTextContent.textContent = text;
            return;
        }

        // Cache lookup
        const cacheKey = `${mode}-${text}`;
        if (translationCache[cacheKey]) {
            if (subtitleTextContent) subtitleTextContent.textContent = translationCache[cacheKey];
            return;
        }

        if (subtitleTextContent) subtitleTextContent.innerHTML = `<span class="loading-inline">Traductions / Simplification CUA... ⏳</span>`;

        let prompt = "";
        if (mode === 'simplifie') {
            prompt = `Tu es un assistant CUA. Ta tâche est de simplifier et de reformuler le texte suivant en français très simple, clair, accessible et direct (sans métaphore complexe, vocabulaire difficile, ou phrases longues) pour un élève DYS ou ayant des difficultés de compréhension. Conserve uniquement l'idée principale.
TEXTE À SIMPLIFIER :
"${text}"
RÉPONSES CONSEILS : Rends uniquement la phrase simplifiée, sans aucune introduction ni conclusion.`;
        } else {
            const langName = mode === 'en' ? 'Anglais' : mode === 'es' ? 'Espagnol' : 'Arabe';
            prompt = `Tu es un traducteur instantané de cours de classe. Traduis fidèlement le texte suivant en ${langName}.
TEXTE À TRADUIRE :
"${text}"
RÉPONSES CONSEILS : Rends uniquement la traduction exacte, sans aucune introduction, commentaire ou guillemets.`;
        }

        // Make streaming call to Albert
        let fullResponse = "";
        try {
            await makeStreamingRequest(prompt, {
                tool: 'formalizer', // Use Albert endpoint parameters
                provider: 'albert',
                model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
            }, (chunk) => {
                fullResponse += chunk;
                if (subtitleTextContent) {
                    subtitleTextContent.textContent = fullResponse;
                }
            }, (complete) => {
                translationCache[cacheKey] = complete.trim();
            }, (err) => {
                console.error("Translation API failure:", err);
                if (subtitleTextContent) subtitleTextContent.textContent = text; // fallback to original
            });
        } catch (e) {
            console.error("Translation request error:", e);
            if (subtitleTextContent) subtitleTextContent.textContent = text;
        }
    }

    // Shared PDF or generated document sync
    function addSharedDocument(doc) {
        // Doc object: { id, title, content, type (fiche, mindmap, todo, cours) }
        const exists = sharedDocs.some(d => d.id === doc.id);
        if (!exists) {
            sharedDocs.push(doc);
        } else {
            // Update
            sharedDocs = sharedDocs.map(d => d.id === doc.id ? doc : d);
        }

        studentDocsPanel.style.display = 'block';
        
        // Redraw lists
        renderSharedDocsList();
    }

    function renderSharedDocsList() {
        studentDocsList.innerHTML = '';
        
        if (sharedDocs.length === 0) {
            studentDocsList.innerHTML = `<p class="placeholder-text">Aucun document partagé pour le moment.</p>`;
            return;
        }

        sharedDocs.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'shared-doc-card';
            card.innerHTML = `
                <div class="doc-icon">📂</div>
                <div class="doc-meta">
                    <span class="doc-title">${doc.title}</span>
                    <span class="doc-type-badge">${doc.type.toUpperCase()}</span>
                </div>
                <button class="btn btn-secondary btn-sm read-doc-btn" data-id="${doc.id}">Visualiser</button>
            `;
            
            card.querySelector('.read-doc-btn').addEventListener('click', () => {
                viewDocument(doc);
            });

            studentDocsList.appendChild(card);
        });
    }

    function viewDocument(doc) {
        currentViewingDoc = doc;
        studentViewerTitle.textContent = doc.title;
        
        // Parse markdown or normal text
        if (window.marked) {
            studentViewerContent.innerHTML = window.marked.parse(doc.content);
        } else {
            studentViewerContent.textContent = doc.content;
        }

        // Render mermaid if present
        if (doc.content.includes('```mermaid') && window.mermaid) {
            setTimeout(() => {
                window.mermaid.init(undefined, studentViewerContent.querySelectorAll('.language-mermaid'));
            }, 100);
        }

        studentDocViewer.style.display = 'block';
        studentDocViewer.scrollIntoView({ behavior: 'smooth' });
    }

    closeStudentViewerBtn?.addEventListener('click', () => {
        studentDocViewer.style.display = 'none';
        currentViewingDoc = null;
    });

    // Adapt Shared Document to Student CUA Code
    studentAdaptDocBtn?.addEventListener('click', async () => {
        if (!currentViewingDoc) {
            alert("Veuillez d'abord ouvrir un document à adapter.");
            return;
        }

        if (!activeCuaCode || activeCuaCode === "Aucun") {
            alert("Veuillez d'abord configurer ou saisir un code d'adaptation CUA.");
            if (cuaSettingsModal) cuaSettingsModal.classList.add('show');
            return;
        }

        studentAdaptDocBtn.disabled = true;
        studentAdaptDocBtn.textContent = "Adaptation en cours... ⏳";
        
        const originalTitle = currentViewingDoc.title;
        const originalContent = currentViewingDoc.content;
        
        // Describe adaptation preferences in the prompt based on answers
        let cuaInstructions = "Adapte ce document selon les consignes CUA :\n";
        
        if (activeCuaPrefs.fontSize === 'C' || activeCuaPrefs.fontSize === 'D') {
            cuaInstructions += "- Agrandis les titres et sépare nettement les idées par de grands espaces.\n";
        }
        if (activeCuaPrefs.layout === 'C') {
            cuaInstructions += "- Découpe chaque phase ou consigne en blocs numérotés très clairs (un bloc à la fois).\n";
        }
        if (activeCuaPrefs.layout === 'D') {
            cuaInstructions += "- Réduis le texte au strict nécessaire en français simplifié (FALC) avec des mots importants en gras.\n";
        }
        if (activeCuaCode.includes('-D-') || activeCuaCode.endsWith('-D')) {
            cuaInstructions += "- Simplifie le vocabulaire de façon extrême et ajoute des explications courtes entre parenthèses pour les mots techniques.\n";
        }

        const prompt = `Tu es un ingénieur pédagogique expert CUA.
Tâche : Adapte le document suivant en appliquant les consignes d'accessibilité ci-dessous.
CONSIGNES CUA :
${cuaInstructions}

DOCUMENT ORIGINAL :
"""
${originalContent}
"""

CONSIGNE STRICTE : Rends uniquement le document adapté au format Markdown, sans introduction ni conclusion de ta part. Conserve les schémas Mermaid s'il y en a, mais assure-toi qu'ils soient lisibles.`;

        let adaptedText = "";
        try {
            await makeStreamingRequest(prompt, {
                tool: 'professor',
                provider: 'albert',
                model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
            }, (chunk) => {
                adaptedText += chunk;
                if (studentViewerContent) {
                    if (window.marked) {
                        studentViewerContent.innerHTML = window.marked.parse(adaptedText);
                    } else {
                        studentViewerContent.textContent = adaptedText;
                    }
                }
            }, (complete) => {
                studentAdaptDocBtn.disabled = false;
                studentAdaptDocBtn.textContent = "🔄 Adapter à mon profil (CUA)";
                window.showToast("Document adapté appliqué ! ✓");
                
                // Add adapted tag to title
                studentViewerTitle.textContent = `${originalTitle} [Adapté CUA]`;
                
                // Render mermaid diagrams
                if (complete.includes('```mermaid') && window.mermaid) {
                    window.mermaid.init(undefined, studentViewerContent.querySelectorAll('.language-mermaid'));
                }
            }, (err) => {
                console.error("Adapt doc error:", err);
                alert("Erreur lors de l'adaptation du document.");
                studentAdaptDocBtn.disabled = false;
                studentAdaptDocBtn.textContent = "🔄 Adapter à mon profil (CUA)";
            });
        } catch (e) {
            console.error("Adapt doc call failure:", e);
            studentAdaptDocBtn.disabled = false;
            studentAdaptDocBtn.textContent = "🔄 Adapter à mon profil (CUA)";
        }
    });

    // Apply accessibility settings based on CUA code
    function applyCuaProfile(code) {
        if (!code || !code.startsWith('CUA-')) return;
        
        if (cuaAppliedCodeText) {
            cuaAppliedCodeText.textContent = `Profil CUA : ${code}`;
            cuaAppliedCodeText.className = 'cua-code-status active';
        }

        // Split code segments (e.g. CUA-A-B-C-A-B-C-A-A-B-D)
        const parts = code.split('-');
        if (parts.length < 11) return;

        const prefs = {
            reading: parts[1],       // Q1
            fontSize: parts[2],      // Q2
            layout: parts[3],        // Q3
            consigneLen: parts[4],   // Q4
            comprehension: parts[5], // Q5
            quantity: parts[6],      // Q6
            speed: parts[7],         // Q7
            writing: parts[8],       // Q8
            answersFormat: parts[9], // Q9
            repereVisuel: parts[10]  // Q10
        };

        activeCuaPrefs = prefs;

        // Reset classes
        document.body.classList.remove('accessibility-dyslexia');
        document.body.classList.remove('student-layout-spaced');
        document.body.classList.remove('student-layout-minimal');
        document.body.classList.remove('student-contrast-dark');
        document.body.classList.remove('student-contrast-highlight');

        // Apply Q2 (Font Size) globally to student active area
        if (studentActiveContainer) {
            studentActiveContainer.style.fontSize = prefs.fontSize === 'B' ? '1.1rem' : 
                                                    prefs.fontSize === 'C' ? '1.3rem' : 
                                                    prefs.fontSize === 'D' ? '1.5rem' : '1rem';
        }

        // Apply Q1 (Dyslexia Check)
        if (prefs.reading === 'C' || prefs.reading === 'D' || prefs.fontSize === 'C') {
            document.body.classList.add('accessibility-dyslexia');
        }

        // Apply Q3 (Layout)
        if (prefs.layout === 'B') {
            document.body.classList.add('student-layout-spaced');
        } else if (prefs.layout === 'D') {
            document.body.classList.add('student-layout-minimal');
        }

        // Apply Q10 (Visual theme / Contrast)
        if (prefs.repereVisuel === 'C') {
            document.body.classList.add('student-contrast-highlight');
        } else if (prefs.repereVisuel === 'D') {
            document.body.classList.add('student-contrast-dark');
            // Dynamically override styles
            document.documentElement.style.setProperty('--bg', '#000000');
            document.documentElement.style.setProperty('--surface', '#111111');
            document.documentElement.style.setProperty('--text', '#ffffff');
        }

        // Apply Subtitles Lang Option defaults based on profile
        if (prefs.reading === 'C' || prefs.reading === 'D') {
            // Suggest simplified text by default
            if (subtitleLangSelect) subtitleLangSelect.value = 'simplifie';
        }
    }
}
