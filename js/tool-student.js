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

    // Student Playlist variables
    const openStudentPlaylistBtn = document.getElementById('openStudentPlaylistBtn');
    const studentPlaylistPanel = document.getElementById('studentPlaylistPanel');
    const closeStudentPlaylistPanelBtn = document.getElementById('closeStudentPlaylistPanelBtn');
    const studentPlaylistItemsList = document.getElementById('studentPlaylistItemsList');

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
    let studentPlaylist = [];

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
        } else if (w.type === 'media') {
            const url = w.content || "";
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
