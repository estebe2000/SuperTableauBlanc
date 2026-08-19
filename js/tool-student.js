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

    // Notebook variables
    const openStudentNotebookBtn = document.getElementById('openStudentNotebookBtn');
    const studentNotebookPanel = document.getElementById('studentNotebookPanel');
    const closeStudentNotebookBtn = document.getElementById('closeStudentNotebookBtn');
    const studentPersonalNotes = document.getElementById('studentPersonalNotes');
    const aiExplainSelectionBtn = document.getElementById('aiExplainSelectionBtn');
    const exportStudentNotesBtn = document.getElementById('exportStudentNotesBtn');
    const aiExplanationBox = document.getElementById('aiExplanationBox');
    const aiExplanationContent = document.getElementById('aiExplanationContent');
    const closeAiExpBtn = document.getElementById('closeAiExpBtn');
    const studentPastNotesSelect = document.getElementById('studentPastNotesSelect');
    const studentNotebookSessionLabel = document.getElementById('studentNotebookSessionLabel');

    // Understanding Feedback buttons
    const btnUnderstandings = document.querySelectorAll('.btn-understanding');

    // Flash Quiz Modal
    const studentQuizModal = document.getElementById('studentQuizModal');
    const studentQuizModalCloseArea = document.getElementById('studentQuizModalCloseArea');
    const studentQuizQuestionText = document.getElementById('studentQuizQuestionText');
    const studentQuizOptions = document.getElementById('studentQuizOptions');
    const studentQuizAnsweredFeedback = document.getElementById('studentQuizAnsweredFeedback');

    // Modal variables
    const cuaSettingsModal = document.getElementById('cuaSettingsModal');
    const closeCuaModalBtn = document.getElementById('closeCuaModalBtn');
    const cuaModalCloseArea = document.getElementById('cuaModalCloseArea');
    const cuaCodeInput = document.getElementById('cuaCodeInput');
    const applyCuaCodeBtn = document.getElementById('applyCuaCodeBtn');
    const launchProfilingFromModalBtn = document.getElementById('launchProfilingFromModalBtn');

    // Student Playlist variables
    const openStudentPlaylistBtn = document.getElementById('openStudentPlaylistBtn');
    const studentPlaylistPanel = document.getElementById('studentPlaylistPanel');
    const closeStudentPlaylistPanelBtn = document.getElementById('closeStudentPlaylistPanelBtn');
    const studentPlaylistItemsList = document.getElementById('studentPlaylistItemsList');

    if (!studentJoinContainer || !studentJoinBtn || !studentActiveContainer) {
        console.warn("Student view DOM elements not found, skipping.");
        return;
    }

    // Unique persistent student identifier
    let myStudentId = localStorage.getItem('student_device_id');
    if (!myStudentId) {
        myStudentId = `stud_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('student_device_id', myStudentId);
    }

    let socket = null;
    let sessionCode = "";
    let originalTranscript = "";
    let activeCuaCode = "";
    let activeCuaPrefs = {};
    let subFontSizePx = 18;
    let sharedDocs = [];
    let currentViewingDoc = null;
    let studentPlaylist = [];
    let currentQuizAnswered = false;

    // Helper functions for student local windows
    function makeDraggable(el, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.style.cursor = 'grab';
        handle.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            e = e || window.event;
            // Ignore if clicked on a button or interactive child
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
            if (e.button !== 0) return;
            e.preventDefault();
            
            handle.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            document.addEventListener('mouseup', closeDragElement);
            document.addEventListener('mousemove', elementDrag);
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let newX = el.offsetLeft - pos1;
            let newY = el.offsetTop - pos2;

            const maxLeft = studentDesktop.clientWidth - el.clientWidth;
            const maxTop = studentDesktop.clientHeight - el.clientHeight;
            newX = Math.max(0, Math.min(newX, maxLeft));
            newY = Math.max(0, Math.min(newY, maxTop));

            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        }

        function closeDragElement() {
            document.removeEventListener('mouseup', closeDragElement);
            document.removeEventListener('mousemove', elementDrag);
            handle.style.cursor = 'grab';
            document.body.style.cursor = 'default';
        }
    }

    function makeResizable(el) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'widget-resize-handle';
        el.appendChild(resizeHandle);
        resizeHandle.onmousedown = initResize;

        function initResize(e) {
            e.preventDefault();
            window.addEventListener('mousemove', startResize, false);
            window.addEventListener('mouseup', stopResize, false);
        }

        function startResize(e) {
            let newWidth = e.clientX - el.getBoundingClientRect().left;
            let newHeight = e.clientY - el.getBoundingClientRect().top;
            newWidth = Math.max(150, Math.min(newWidth, 1600));
            newHeight = Math.max(60, Math.min(newHeight, 800));
            el.style.width = `${newWidth}px`;
            el.style.height = `${newHeight}px`;
        }

        function stopResize() {
            window.removeEventListener('mousemove', startResize, false);
            window.removeEventListener('mouseup', stopResize, false);
        }
    }

    function showVisualPing(xPercent, yPercent) {
        if (!studentDesktop) return;

        const ping = document.createElement('div');
        ping.className = 'student-ping-indicator';
        ping.style.left = `${xPercent * 100}%`;
        ping.style.top = `${yPercent * 100}%`;

        const core = document.createElement('div');
        core.className = 'student-ping-core';
        ping.appendChild(core);

        studentDesktop.appendChild(ping);

        setTimeout(() => {
            ping.remove();
        }, 1200);
    }

    function updateStudentPlaylist(playlistData) {
        if (!playlistData) return;
        studentPlaylist = playlistData;
        updateStudentPlaylistDOM();
    }

    function updateStudentPlaylistDOM() {
        if (!studentPlaylistItemsList) return;
        
        // Auto-sync files from playlist into sharedDocs list
        studentPlaylist.forEach(item => {
            if (item.type === 'pdf' || item.title.endsWith('.pdf') || item.title.endsWith('.docx')) {
                if (!sharedDocs.some(d => d.title === item.title)) {
                    sharedDocs.push({
                        id: item.id,
                        title: item.title,
                        type: item.type,
                        content: "",
                        url: item.url
                    });
                }
            }
        });
        
        if (studentPlaylist.length === 0) {
            studentPlaylistItemsList.innerHTML = `
                <div style="font-size:0.8rem; text-align:center; padding:20px; color:rgba(255,255,255,0.4);">
                    Aucun média disponible pour le moment.
                </div>
            `;
            return;
        }

        studentPlaylistItemsList.innerHTML = '';
        studentPlaylist.forEach(item => {
            const el = document.createElement('div');
            el.className = 'playlist-item';
            el.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px; margin-bottom:8px; font-size:0.8rem; color:white;';
            
            const icon = item.type === 'image' ? '🖼️' :
                         item.type === 'video' ? '🎥' :
                         item.type === 'audio' ? '🎵' : '📄';
                         
            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; margin-right:8px;">
                    <span style="font-size:1.1rem;">${icon}</span>
                    <span title="${item.title}" style="overflow:hidden; text-overflow:ellipsis;">${item.title}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm play-media-btn" title="Afficher et remplacer" style="padding: 2px 6px;">👁️</button>
                    <button class="btn btn-primary btn-sm add-apart-btn" title="Ouvrir à part" style="padding: 2px 6px;">➕</button>
                </div>
            `;
            
            el.querySelector('.play-media-btn').addEventListener('click', () => {
                displayMediaOnStudentDesktop(item, false);
            });

            el.querySelector('.add-apart-btn').addEventListener('click', () => {
                displayMediaOnStudentDesktop(item, true);
            });
            
            studentPlaylistItemsList.appendChild(el);
        });
    }

    function displayMediaOnStudentDesktop(item, openNewWindow = false) {
        studentDesktopPlaceholder.style.display = 'none';
        
        let targetWidget = null;
        if (!openNewWindow) {
            targetWidget = studentDesktop.querySelector('.widget-local-media');
        }
        
        if (targetWidget) {
            const titleSpan = targetWidget.querySelector('.widget-title');
            if (titleSpan) titleSpan.textContent = `👁️ visionneuse élève : ${item.title}`;
            const body = targetWidget.querySelector('.widget-content-body');
            if (body) {
                const widgetObj = {
                    type: 'media',
                    mediaType: item.type,
                    content: item.url
                };
                renderWidgetContent(body, widgetObj);
            }
            window.showToast(`Média remplacé : ${item.title} ✓`);
        } else {
            const id = `stud-local-${Math.random().toString(36).substring(2, 9)}`;
            const wEl = document.createElement('div');
            wEl.id = id;
            wEl.className = 'widget-instance widget-media widget-local-media';
            
            wEl.style.position = 'absolute';
            wEl.style.left = '40px';
            wEl.style.top = '80px';
            wEl.style.width = '440px';
            wEl.style.height = '330px';
            wEl.style.backgroundColor = 'var(--surface)';
            wEl.style.zIndex = '140';
            wEl.style.border = '1px solid var(--border)';
            wEl.style.borderRadius = '6px';
            wEl.style.display = 'flex';
            wEl.style.flexDirection = 'column';
            wEl.style.overflow = 'hidden';
            
            const header = document.createElement('div');
            header.className = 'widget-header';
            header.style = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface2); border-bottom:1px solid var(--border); padding:6px 10px; font-size:0.8rem; font-weight:600; color:var(--text);';
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="drag-handle-grip" title="Glisser pour déplacer" style="cursor: grab; color: var(--text-muted); font-weight: normal; margin-right: 4px;">⋮⋮</span>
                    <span class="widget-title" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:280px;">👁️ visionneuse élève : ${item.title}</span>
                </div>
                <div class="widget-actions" style="display:flex; align-items:center;">
                    <button class="btn-fullscreen-widget" title="Plein écran" style="margin-right: 6px; padding: 2px 6px; font-size: 0.8rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer;">⛶</button>
                    <button class="btn-close-widget" title="Fermer" style="font-size: 1.2rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; line-height:1;">×</button>
                </div>
            `;
            
            const body = document.createElement('div');
            body.className = 'widget-content-body';
            body.style = 'flex:1; position:relative; overflow:hidden; background:#000; display:flex; align-items:center; justify-content:center;';
            const widgetObj = {
                type: 'media',
                mediaType: item.type,
                content: item.url
            };
            renderWidgetContent(body, widgetObj);
            
            wEl.appendChild(header);
            wEl.appendChild(body);
            studentDesktop.appendChild(wEl);
            
            makeDraggable(wEl, header);
            makeResizable(wEl);
            
            header.querySelector('.btn-close-widget').addEventListener('click', () => {
                wEl.remove();
                const total = studentDesktop.querySelectorAll('.widget-instance').length;
                if (total === 0) {
                    studentDesktopPlaceholder.style.display = 'flex';
                }
            });
            
            header.querySelector('.btn-fullscreen-widget').addEventListener('click', (e) => {
                const isFS = wEl.classList.toggle('widget-fullscreen');
                e.currentTarget.textContent = isFS ? '🗗' : '⛶';
                if (isFS) {
                    wEl.style.left = '0px';
                    wEl.style.top = '0px';
                    wEl.style.width = '100%';
                    wEl.style.height = '100%';
                } else {
                    wEl.style.left = '40px';
                    wEl.style.top = '80px';
                    wEl.style.width = '440px';
                    wEl.style.height = '330px';
                }
            });
            
            window.showToast(`Média local ouvert : ${item.title} ✓`);
        }
    }

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

    // Load stored Student profile / CUA code if exists
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
        if (!code.startsWith('ETUDIANT-') && !code.startsWith('CUA-')) {
            alert("Code invalide. Le code doit commencer par 'ETUDIANT-' ou 'CUA-'.");
            return;
        }
        activeCuaCode = code;
        localStorage.setItem('cua_profile_code', code);
        applyCuaProfile(code);
        closeModal();
        window.showToast("Profil Étudiant appliqué avec succès ! ✨");
    });

    // Student Documents Panel trigger
    const openStudentDocsBtn = document.getElementById('openStudentDocsBtn');
    openStudentDocsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = studentDocsPanel.style.display === 'none';
        if (show) {
            studentDocsPanel.style.display = 'block';
            renderSharedDocsList();
        } else {
            studentDocsPanel.style.display = 'none';
        }
    });

    // Student Playlist trigger
    openStudentPlaylistBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = studentPlaylistPanel.style.display === 'none';
        if (show) {
            studentPlaylistPanel.style.display = 'block';
            studentPlaylistPanel.style.transform = 'none';
            updateStudentPlaylistDOM();
        } else {
            studentPlaylistPanel.style.display = 'none';
        }
    });

    closeStudentPlaylistPanelBtn?.addEventListener('click', () => {
        studentPlaylistPanel.style.display = 'none';
    });

    const studentPlaylistHeader = studentPlaylistPanel?.querySelector('.panel-header');
    if (studentPlaylistPanel && studentPlaylistHeader) {
        makeDraggable(studentPlaylistPanel, studentPlaylistHeader);
    }

    if (studentSubtitlesBanner) {
        const subHeader = studentSubtitlesBanner.querySelector('.subtitle-controls');
        if (subHeader) {
            makeDraggable(studentSubtitlesBanner, subHeader);
        }
        makeResizable(studentSubtitlesBanner);
    }

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

        sessionCode = rawCode.replace(/[\s-]/g, '');
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
                } else if (data.type === 'sync-playlist') {
                    updateStudentPlaylist(data.playlist);
                } else if (data.type === 'sync-doubleclick') {
                    showVisualPing(data.xPercent, data.yPercent);
                } else if (data.type === 'send-document-adaptation') {
                    handleDocumentAdaptationResponse(data);
                } else if (data.type === 'sync-quiz-start') {
                    handleIncomingQuiz(data);
                } else if (data.type === 'sync-quiz-close') {
                    studentQuizModal?.classList.remove('show');
                }
            };

            socket.onclose = () => {
                console.log("[Student] Socket disconnected");
                sessionStatusText.textContent = "⚠️ Déconnecté de la session. Tentative de reconnexion...";
                
                if (studentActiveContainer.style.display !== 'flex') {
                    studentJoinBtn.disabled = false;
                    studentJoinBtn.textContent = "Se connecter au cours 🖥️";
                }

                // Try auto-reconnect after 3 seconds
                setTimeout(() => {
                    if (studentActiveContainer.style.display === 'flex') connectWebSocket();
                }, 3000);
            };

        } catch (e) {
            console.error("Failed connection to WebSocket:", e);
            sessionStatusText.textContent = "Erreur de connexion.";
            studentJoinBtn.disabled = false;
            studentJoinBtn.textContent = "Réessayer 🖥️";
        }
    }

    // ─── UNDERSTANDING THERMOMETER BUTTONS ───
    btnUnderstandings.forEach(btn => {
        btn.addEventListener('click', () => {
            btnUnderstandings.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const status = btn.getAttribute('data-status');
            
            if (socket && socket.readyState === 1) {
                socket.send(JSON.stringify({
                    type: 'sync-understanding',
                    studentId: myStudentId,
                    status: status
                }));
            }
            window.showToast?.("Rythme partagé avec l'enseignant ✓");
        });
    });

    // ─── FLASH QUIZ POPUP (STUDENT) ───
    function handleIncomingQuiz(data) {
        if (!studentQuizModal || !studentQuizQuestionText || !studentQuizOptions) return;
        currentQuizAnswered = false;
        studentQuizQuestionText.textContent = data.question;
        studentQuizOptions.innerHTML = '';
        if (studentQuizAnsweredFeedback) studentQuizAnsweredFeedback.style.display = 'none';

        data.options.forEach((opt, idx) => {
            const letter = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style = 'text-align: left; padding: 12px 16px; font-size: 0.95rem; display: flex; align-items: center; gap: 10px; border-radius: 10px;';
            btn.innerHTML = `<span style="font-weight: 800; color: var(--accent1); font-size: 1.1rem;">${letter}.</span> <span>${opt.text}</span>`;
            
            btn.addEventListener('click', () => {
                if (currentQuizAnswered) return;
                currentQuizAnswered = true;
                btn.style.background = 'linear-gradient(90deg, #dc2626, #ea580c)';
                btn.style.color = 'white';
                btn.style.border = 'none';

                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({
                        type: 'sync-quiz-answer',
                        quizId: data.id,
                        optionId: opt.id,
                        studentId: myStudentId
                    }));
                }

                if (studentQuizAnsweredFeedback) studentQuizAnsweredFeedback.style.display = 'block';
                setTimeout(() => {
                    studentQuizModal.classList.remove('show');
                }, 1800);
            });

            studentQuizOptions.appendChild(btn);
        });

        studentQuizModal.classList.add('show');
    }

    const closeQuizModal = () => studentQuizModal?.classList.remove('show');
    studentQuizModalCloseArea?.addEventListener('click', closeQuizModal);

    // ─── HYBRID STUDENT NOTEBOOK & PAST NOTES HISTORY ───
    function populateStudentPastNotesSelect() {
        if (!studentPastNotesSelect) return;
        studentPastNotesSelect.innerHTML = `<option value="current">📝 Notes de ce cours</option>`;
        
        try {
            const raw = localStorage.getItem('student_notes_history');
            const history = raw ? JSON.parse(raw) : [];
            history.forEach(item => {
                if (item.sessionCode !== sessionCode && item.text?.trim()) {
                    const opt = document.createElement('option');
                    opt.value = item.sessionCode;
                    opt.textContent = `📅 ${item.dateFormatted || item.sessionCode} (${item.text.substring(0, 20)}...)`;
                    studentPastNotesSelect.appendChild(opt);
                }
            });
        } catch (e) {}
    }

    studentPastNotesSelect?.addEventListener('change', () => {
        const val = studentPastNotesSelect.value;
        if (val === 'current') {
            const cur = localStorage.getItem(`student_notes_${sessionCode}`) || '';
            if (studentPersonalNotes) studentPersonalNotes.value = cur;
        } else {
            try {
                const raw = localStorage.getItem('student_notes_history');
                const history = raw ? JSON.parse(raw) : [];
                const found = history.find(h => h.sessionCode === val);
                if (found && studentPersonalNotes) {
                    studentPersonalNotes.value = found.text;
                }
            } catch (e) {}
        }
    });

    openStudentNotebookBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = studentNotebookPanel.style.display === 'none';
        if (show) {
            studentNotebookPanel.style.display = 'block';
            if (studentNotebookSessionLabel) {
                studentNotebookSessionLabel.textContent = sessionCode ? `Code ${sessionCode}` : "Session Locale";
            }
            populateStudentPastNotesSelect();
            const saved = localStorage.getItem(`student_notes_${sessionCode}`);
            if (saved && studentPersonalNotes) studentPersonalNotes.value = saved;
        } else {
            studentNotebookPanel.style.display = 'none';
        }
    });

    closeStudentNotebookBtn?.addEventListener('click', () => {
        if (studentNotebookPanel) studentNotebookPanel.style.display = 'none';
    });

    const notebookHeader = studentNotebookPanel?.querySelector('.panel-header');
    if (studentNotebookPanel && notebookHeader) {
        makeDraggable(studentNotebookPanel, notebookHeader);
    }

    studentPersonalNotes?.addEventListener('input', () => {
        if (sessionCode) {
            const content = studentPersonalNotes.value;
            localStorage.setItem(`student_notes_${sessionCode}`, content);
            
            // Save to notes history
            try {
                const raw = localStorage.getItem('student_notes_history');
                let history = raw ? JSON.parse(raw) : [];
                history = history.filter(h => h.sessionCode !== sessionCode);
                history.unshift({
                    sessionCode: sessionCode,
                    dateFormatted: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    text: content
                });
                if (history.length > 20) history = history.slice(0, 20);
                localStorage.setItem('student_notes_history', JSON.stringify(history));
            } catch (e) {}
        }
    });

    aiExplainSelectionBtn?.addEventListener('click', async () => {
        let selectedText = window.getSelection()?.toString().trim();
        if (!selectedText && studentPersonalNotes) {
            const start = studentPersonalNotes.selectionStart;
            const end = studentPersonalNotes.selectionEnd;
            if (start !== end) {
                selectedText = studentPersonalNotes.value.substring(start, end).trim();
            }
        }

        if (!selectedText) {
            alert("Veuillez surligner un mot ou une phrase (dans vos notes ou dans le document) à expliquer.");
            return;
        }

        if (aiExplanationBox) aiExplanationBox.style.display = 'block';
        if (aiExplanationContent) aiExplanationContent.innerHTML = `<em>💡 Albert simplifie pour vous : « ${selectedText} »...</em>`;

        const prompt = `Tu es Albert, tuteur inclusif bienveillant. Explique de manière très simple, claire, concrète et imagée (style FALC / Facile à Lire et à Comprendre) le terme ou la phrase suivante :
"${selectedText}"

Donne :
1. Une définition simple en 1-2 phrases courtes.
2. Un exemple du quotidien parlant.
Sois encourageant et accessible.`;

        try {
            let res = "";
            await makeStreamingRequest(prompt, {
                tool: 'professor',
                provider: 'albert',
                model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
            }, (chunk) => {
                res += chunk;
                if (aiExplanationContent) {
                    aiExplanationContent.innerHTML = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                }
            }, (complete) => {
                if (aiExplanationContent) {
                    aiExplanationContent.innerHTML = complete.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                }
            }, (err) => {
                if (aiExplanationContent) aiExplanationContent.innerHTML = `<span style="color:#ef4444;">Erreur : ${err.message}</span>`;
            });
        } catch (e) {
            if (aiExplanationContent) aiExplanationContent.innerHTML = `<span style="color:#ef4444;">Erreur d'explication.</span>`;
        }
    });

    closeAiExpBtn?.addEventListener('click', () => {
        if (aiExplanationBox) aiExplanationBox.style.display = 'none';
    });

    exportStudentNotesBtn?.addEventListener('click', () => {
        const text = studentPersonalNotes?.value || "(Aucune note)";
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Mes_Notes_Cours_${sessionCode || 'session'}.md`;
        a.click();
        window.showToast?.("Notes téléchargées ✓");
    });

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
            let url = w.content || "";
            if (url.startsWith('data:')) {
                try {
                    const blob = dataURLtoBlob(url);
                    url = URL.createObjectURL(blob);
                } catch(e) {
                    console.error("Failed to convert Data URL to Blob", e);
                }
            }
            el.innerHTML = `<iframe src="${url}" frameborder="0" style="width:100%; height:100%;"></iframe>`;
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
        } else if (w.type === 'media') {
            let url = w.content || "";
            if (url.startsWith('data:')) {
                try {
                    const blob = dataURLtoBlob(url);
                    url = URL.createObjectURL(blob);
                } catch(e) {
                    console.error("Failed to convert Data URL to Blob", e);
                }
            }
            if (w.mediaType === 'image') {
                el.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:contain; border-radius:0 0 6px 6px;">`;
            } else if (w.mediaType === 'video') {
                if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com') || url.includes('youtube.com/watch') || url.includes('youtu.be')) {
                    let embedUrl = url;
                    if (url.includes('youtube.com/watch')) {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                        const match = url.match(regExp);
                        if (match && match[2].length === 11) {
                            embedUrl = `https://www.youtube.com/embed/${match[2]}`;
                        }
                    } else if (url.includes('youtu.be/')) {
                        const parts = url.split('youtu.be/');
                        if (parts.length > 1) {
                            embedUrl = `https://www.youtube.com/embed/${parts[1].split('?')[0]}`;
                        }
                    }
                    el.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen style="width:100%; height:100%; border:none; border-radius:0 0 6px 6px;"></iframe>`;
                } else {
                    el.innerHTML = `<video src="${url}" controls style="width:100%; height:100%; object-fit:contain; border-radius:0 0 6px 6px;"></video>`;
                }
            } else if (w.mediaType === 'audio') {
                el.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:rgba(255,255,255,0.03); border-radius:0 0 6px 6px; padding:10px;"><span style="font-size:2rem; margin-bottom:8px;">🎵</span><audio src="${url}" controls style="width:90%;"></audio></div>`;
            } else {
                el.innerHTML = `<iframe src="${url}" frameborder="0" style="width:100%; height:100%; border:none; border-radius:0 0 6px 6px; background:white;"></iframe>`;
            }
        }
    }

    function dataURLtoBlob(dataurl) {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    function applyDesktopBackground(bg) {
        if (!studentDesktop) return;
        studentDesktop.style.backgroundImage = 'none';
        studentDesktop.style.backgroundSize = 'initial';
        studentDesktop.style.backgroundPosition = 'initial';
        studentDesktop.style.backgroundColor = 'var(--surface)';

        if (bg.startsWith('http://') || bg.startsWith('https://') || bg.startsWith('data:image/')) {
            studentDesktop.style.backgroundImage = `url(${bg})`;
            studentDesktop.style.backgroundSize = 'cover';
            studentDesktop.style.backgroundPosition = 'center';
        } else if (bg === 'blackboard') {
            studentDesktop.style.backgroundColor = '#162e20';
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
            // Default background: warm off-white (blanc cassé)
            studentDesktop.style.backgroundColor = '#faf9f5';
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

    // Extract clean rolling snippet for floating subtitle overlay
    function getRollingSubtitleSnippet(fullText) {
        if (!fullText) return "";
        if (fullText.length <= 280) return fullText;
        const slice = fullText.slice(-280);
        const firstSpace = slice.indexOf(' ');
        return (firstSpace > 0 ? "…" + slice.substring(firstSpace) : "…" + slice).trim();
    }

    // Handle live audio transcripts from teacher
    function handleLiveTranscript(text, isFinal) {
        originalTranscript = text;
        const displaySnippet = getRollingSubtitleSnippet(text);

        if (isFinal) {
            if (subtitleTextLoader) subtitleTextLoader.style.display = 'none';
            processSubtitleTranslation(displaySnippet);
        } else {
            if (subtitleTextLoader) subtitleTextLoader.style.display = 'inline-flex';
            
            const selectedLang = subtitleLangSelect.value;
            if (selectedLang === 'fr') {
                if (subtitleTextContent) subtitleTextContent.textContent = displaySnippet;
            } else {
                if (subtitleTextContent) subtitleTextContent.innerHTML = `<span style="font-style: italic; opacity: 0.6;">(En cours...) ${displaySnippet}</span>`;
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

    const viewOriginalDocTabBtn = document.getElementById('viewOriginalDocTabBtn');
    const viewAdaptedDocTabBtn = document.getElementById('viewAdaptedDocTabBtn');
    const downloadAdaptedDocBtn = document.getElementById('downloadAdaptedDocBtn');

    function viewDocument(doc) {
        currentViewingDoc = doc;
        studentViewerTitle.textContent = doc.title;
        
        // Reset tabs to original version
        viewOriginalDocTabBtn?.classList.add('active');
        viewAdaptedDocTabBtn?.classList.remove('active');
        if (downloadAdaptedDocBtn) downloadAdaptedDocBtn.style.display = 'none';

        // Load original content
        showOriginalContent(doc);

        studentDocViewer.style.display = 'flex';
        studentDocViewer.scrollIntoView({ behavior: 'smooth' });
    }

    function showOriginalContent(doc) {
        if (doc.url) {
            // For files (PDF/docx), display them in an iframe!
            let targetUrl = doc.url;
            if (targetUrl.startsWith('data:')) {
                try {
                    const blob = dataURLtoBlob(targetUrl);
                    targetUrl = URL.createObjectURL(blob);
                } catch(e) {
                    console.error("Failed to parse data URL in viewer", e);
                }
            }
            studentViewerContent.innerHTML = `<iframe src="${targetUrl}" frameborder="0" style="width:100%; height:450px; border:none; background:white; border-radius:8px;"></iframe>`;
        } else {
            // Standard markdown/text content
            if (window.marked) {
                studentViewerContent.innerHTML = window.marked.parse(doc.content || "");
            } else {
                studentViewerContent.textContent = doc.content || "";
            }
        }
    }

    viewOriginalDocTabBtn?.addEventListener('click', () => {
        if (!currentViewingDoc) return;
        viewOriginalDocTabBtn.classList.add('active');
        viewAdaptedDocTabBtn?.classList.remove('active');
        if (downloadAdaptedDocBtn) downloadAdaptedDocBtn.style.display = 'none';
        showOriginalContent(currentViewingDoc);
    });

    viewAdaptedDocTabBtn?.addEventListener('click', () => {
        if (!currentViewingDoc) return;
        
        viewOriginalDocTabBtn?.classList.remove('active');
        viewAdaptedDocTabBtn.classList.add('active');

        // Check if already adapted
        if (currentViewingDoc.adaptedContent) {
            displayAdaptedContent(currentViewingDoc.adaptedContent);
            return;
        }

        // Check CUA code
        if (!activeCuaCode || activeCuaCode === "Aucun") {
            alert("Veuillez d'abord configurer ou saisir un code d'adaptation CUA.");
            if (cuaSettingsModal) cuaSettingsModal.classList.add('show');
            // Back to original tab
            viewOriginalDocTabBtn?.classList.add('active');
            viewAdaptedDocTabBtn.classList.remove('active');
            return;
        }

        // Request adaptation from teacher/server via WebSockets
        studentViewerContent.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; color:rgba(255,255,255,0.6);">
                <div style="font-size:2.5rem; margin-bottom:12px; animation: spin 2s linear infinite;">⏳</div>
                <div style="font-weight:700; margin-bottom:6px;">Adaptation personnalisée en cours...</div>
                <div style="font-size:0.78rem; max-width:280px; color:rgba(255,255,255,0.4);">
                    Albert AI (enseignant) analyse le document en fonction de votre profil CUA (${activeCuaCode}).
                </div>
            </div>
        `;

        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'request-document-adaptation',
                docId: currentViewingDoc.id,
                docTitle: currentViewingDoc.title,
                docContent: currentViewingDoc.content || "",
                cuaCode: activeCuaCode,
                cuaPrefs: activeCuaPrefs
            }));
        } else {
            studentViewerContent.innerHTML = `
                <div style="color:var(--accent1); padding:20px; text-align:center;">
                    ⚠️ Erreur : non connecté à la classe. Impossible de contacter le serveur d'adaptation.
                </div>
            `;
        }
    });

    function displayAdaptedContent(content) {
        if (window.marked) {
            studentViewerContent.innerHTML = window.marked.parse(content);
        } else {
            studentViewerContent.textContent = content;
        }
        
        // Show download button
        if (downloadAdaptedDocBtn) downloadAdaptedDocBtn.style.display = 'inline-flex';
        
        // Render mermaid diagrams
        if (content.includes('```mermaid') && window.mermaid) {
            setTimeout(() => {
                window.mermaid.init(undefined, studentViewerContent.querySelectorAll('.language-mermaid'));
            }, 100);
        }
    }

    downloadAdaptedDocBtn?.addEventListener('click', () => {
        if (!currentViewingDoc || !currentViewingDoc.adaptedContent) return;
        
        const opt = {
            margin:       15,
            filename:     `${currentViewingDoc.title}_CUA_adapte.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Temporarily prepare styled container for PDF print
        const printContainer = document.createElement('div');
        printContainer.className = 'markdown-content';
        printContainer.style = `
            font-family: ${activeCuaCode.includes('-D-') || activeCuaCode.endsWith('-D') ? 'OpenDyslexic, Arial, sans-serif' : 'Inter, Arial, sans-serif'};
            color: #000000;
            background: #ffffff;
            padding: 20px;
            font-size: 1.1rem;
            line-height: 1.6;
        `;
        printContainer.innerHTML = window.marked ? window.marked.parse(currentViewingDoc.adaptedContent) : currentViewingDoc.adaptedContent;
        
        // Render
        if (window.html2pdf) {
            window.html2pdf().set(opt).from(printContainer).save();
        } else {
            alert("Erreur: Librairie de conversion PDF non chargée.");
        }
    });

    function handleDocumentAdaptationResponse(data) {
        const { docId, docTitle, adaptedContent } = data;
        
        // Find the doc in sharedDocs
        const doc = sharedDocs.find(d => d.id === docId || d.title === docTitle);
        if (doc) {
            doc.adaptedContent = adaptedContent;
            
            // If the student is currently viewing this document
            if (currentViewingDoc && (currentViewingDoc.id === docId || currentViewingDoc.title === docTitle)) {
                currentViewingDoc.adaptedContent = adaptedContent;
                // Display it!
                if (viewAdaptedDocTabBtn?.classList.contains('active')) {
                    displayAdaptedContent(adaptedContent);
                }
            }
            window.showToast("Document adapté reçu ! ✨");
        }
    }

    closeStudentViewerBtn?.addEventListener('click', () => {
        studentDocViewer.style.display = 'none';
        currentViewingDoc = null;
    });

    // Apply accessibility settings based on Student profile / CUA code
    function applyCuaProfile(code) {
        if (!code || (!code.startsWith('ETUDIANT-') && !code.startsWith('CUA-'))) return;
        
        if (cuaAppliedCodeText) {
            cuaAppliedCodeText.textContent = `Profil Actif : ${code}`;
            cuaAppliedCodeText.className = 'cua-code-status active';
        }

        // Split code segments (e.g. ETUDIANT-A-B-C-A-B-C-A-A-B-D)
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
