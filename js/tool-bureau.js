import { makeStreamingRequest } from './api.js';

export function initBureau() {
    const startSessionBtn = document.getElementById('startSessionBtn');
    const stopSessionBtn = document.getElementById('stopSessionBtn');
    const sessionSharingDetails = document.getElementById('sessionSharingDetails');
    const teacherSessionCode = document.getElementById('teacherSessionCode');
    const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
    const showSessionQrBtn = document.getElementById('showSessionQrBtn');
    const bureauDesktop = document.getElementById('bureauDesktop');
    const bureauPlaceholderInfo = document.getElementById('bureauPlaceholderInfo');

    // Drawing Widget DOM Elements
    const wDrawing = document.getElementById('w-drawing');
    const drawingCanvas = document.getElementById('drawingCanvas');
    const drawColorPicker = document.getElementById('drawColorPicker');
    const drawSizeSlider = document.getElementById('drawSizeSlider');
    const clearCanvasBtn = document.getElementById('clearCanvasBtn');

    // Backgrounds
    const bgOptBtns = document.querySelectorAll('.bg-opt-btn');

    // Microphone & Transcription (Floating)
    const floatingTranscribeBar = document.getElementById('floatingTranscribeBar');
    const floatingRecordTimer = document.getElementById('floatingRecordTimer');
    const liveTranscriptTextarea = document.getElementById('liveTranscriptTextarea');
    const clearTranscriptBtn = document.getElementById('clearTranscriptBtn');

    // Floating panels & Popover
    const bgPopover = document.getElementById('bgPopover');
    const filesFloatingPanel = document.getElementById('filesFloatingPanel');
    const closeFilesPanelBtn = document.getElementById('closeFilesPanelBtn');
    const aiFloatingPanel = document.getElementById('aiFloatingPanel');
    const closeAiPanelBtn = document.getElementById('closeAiPanelBtn');

    // macOS Dock
    const macosDock = document.getElementById('macosDock');
    const dockItems = document.querySelectorAll('.dock-item[data-widget]');
    const dockMicrophone = document.getElementById('dockMicrophone');
    const dockBackground = document.getElementById('dockBackground');
    const dockFiles = document.getElementById('dockFiles');
    const dockAi = document.getElementById('dockAi');

    // Document drop & AI
    const bureauDropZone = document.getElementById('bureauDropZone');
    const bureauFileInput = document.getElementById('bureauFileInput');
    const bureauFilesList = document.getElementById('bureauFilesList');
    const cuaDocFormatSelect = document.getElementById('cuaDocFormatSelect');
    const generateCuaDocBtn = document.getElementById('generateCuaDocBtn');
    const teacherDocOutputPanel = document.getElementById('teacherDocOutputPanel');
    const aiDocSkeleton = document.getElementById('aiDocSkeleton');
    const aiDocOutput = document.getElementById('aiDocOutput');
    const generatedDocTitle = document.getElementById('generatedDocTitle');
    const broadcastDocBtn = document.getElementById('broadcastDocBtn');
    const closeDocOutputBtn = document.getElementById('closeDocOutputBtn');

    // QR Modal
    const sessionQrModal = document.getElementById('sessionQrModal');
    const sessionQrModalCloseArea = document.getElementById('sessionQrModalCloseArea');
    const closeSessionQrModalBtn = document.getElementById('closeSessionQrModalBtn');
    const sessionQrCodeImg = document.getElementById('sessionQrCodeImg');
    const sessionQrCodeLabel = document.getElementById('sessionQrCodeLabel');
    const sessionQrLinkUrl = document.getElementById('sessionQrLinkUrl');

    if (!bureauDesktop || !startSessionBtn) {
        console.warn("Bureau Virtuel DOM elements not found, skipping.");
        return;
    }

    let socket = null;
    let sessionCode = "";
    let activeWidgets = [];
    let backgroundStyle = "default";
    let isDrawing = false;
    let drawingPaths = []; // Array of strokes: { color, width, points: [{x, y}] }
    let currentStroke = null;

    // Transcription & recording variables
    let recognition = null;
    let isRecordingSpeech = false;
    let audioRecorder = null;
    let audioChunks = [];
    let audioRecordStartTime = null;
    let audioTimerInterval = null;
    let base64AudioData = null; // Stored recorded voice for Whisper
    let extractedDocsText = ""; // Compiled uploaded document texts
    let uploadedFiles = [];
    let latestGeneratedDoc = null;

    // ─── SESSION CONTROL ───
    startSessionBtn.addEventListener('click', () => {
        sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        startSessionBtn.style.display = 'none';
        stopSessionBtn.style.display = 'inline-flex';
        sessionSharingDetails.style.display = 'flex';
        teacherSessionCode.textContent = `${sessionCode.substring(0, 3)} ${sessionCode.substring(3)}`;
        
        connectWebSocket();
    });

    stopSessionBtn.addEventListener('click', () => {
        if (socket) {
            socket.close();
            socket = null;
        }

        stopSessionBtn.style.display = 'none';
        startSessionBtn.style.display = 'inline-flex';
        sessionSharingDetails.style.display = 'none';
        
        // Remove all active widgets
        activeWidgets = [];
        bureauDesktop.querySelectorAll('.widget-instance').forEach(w => w.remove());
        clearCanvas();
        
        // Hide floating tools and reset active states
        stopLiveSpeechRecognition();
        stopVoiceRecording();
        if (floatingTranscribeBar) floatingTranscribeBar.style.display = 'none';
        document.querySelectorAll('.dock-item').forEach(i => i.classList.remove('active'));
        hideAllFloatingElements();
        if (wDrawing) wDrawing.style.display = 'none';

        bureauPlaceholderInfo.style.display = 'block';
        window.showToast("Diffusion arrêtée.");
    });

    // ─── macOS DOCK ACTIONS & FLOTTERS ───
    dockItems.forEach(item => {
        item.addEventListener('click', () => {
            const widgetType = item.getAttribute('data-widget');
            
            if (widgetType === 'drawing') {
                const isActive = item.classList.toggle('active');
                if (isActive) {
                    wDrawing.style.display = 'block';
                    bureauPlaceholderInfo.style.display = 'none';
                    initDrawingCanvas();
                } else {
                    wDrawing.style.display = 'none';
                    checkDesktopEmpty();
                }
                syncDesktopState();
            } else if (widgetType === 'postit') {
                createWidget('postit', 'Note adhésive', 'Double-cliquez pour éditer la note.');
            } else if (widgetType === 'timer') {
                createWidget('timer', 'Minuteur', 'Minuteur');
            } else if (widgetType === 'video') {
                const url = prompt("Saisissez l'URL d'une vidéo YouTube (ex: https://www.youtube.com/embed/...) ou MP4 :", "https://www.youtube.com/embed/dQw4w9WgXcQ");
                if (url) createWidget('video', 'Lecteur Vidéo', url);
            } else if (widgetType === 'qrcode') {
                const url = prompt("Saisissez l'URL à partager en QR Code :", window.location.origin);
                if (url) createWidget('qrcode', 'QR Code Partagé', url);
            } else if (widgetType === 'iframe') {
                const url = prompt("Saisissez l'URL du site à intégrer (HTTPS obligatoire) :", "https://fr.wikipedia.org");
                if (url) createWidget('iframe', 'Site web intégré', url);
            }
        });
    });

    // Microphone toggle click
    dockMicrophone?.addEventListener('click', () => {
        const isActive = dockMicrophone.classList.toggle('active');
        if (isActive) {
            floatingTranscribeBar.style.display = 'flex';
            startLiveSpeechRecognition();
            startVoiceRecording();
        } else {
            floatingTranscribeBar.style.display = 'none';
            stopLiveSpeechRecognition();
            stopVoiceRecording();
        }
    });

    // Background options trigger
    dockBackground?.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = bgPopover.style.display === 'none';
        hideAllFloatingElements();
        if (show) {
            bgPopover.style.display = 'block';
            // Position popover above icon
            const rect = dockBackground.getBoundingClientRect();
            const desktopRect = bureauDesktop.getBoundingClientRect();
            bgPopover.style.left = `${rect.left - desktopRect.left - 40}px`;
            bgPopover.style.bottom = '80px';
        }
    });

    // Close background popover on clicking elsewhere
    document.addEventListener('click', () => {
        if (bgPopover) bgPopover.style.display = 'none';
    });

    // Files floating panel
    dockFiles?.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = filesFloatingPanel.style.display === 'none';
        hideAllFloatingElements();
        if (show) {
            filesFloatingPanel.style.display = 'block';
            filesFloatingPanel.style.left = '50%';
            filesFloatingPanel.style.top = '40%';
            filesFloatingPanel.style.transform = 'translate(-50%, -50%)';
        }
    });

    closeFilesPanelBtn?.addEventListener('click', () => {
        filesFloatingPanel.style.display = 'none';
    });

    // AI floating panel
    dockAi?.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = aiFloatingPanel.style.display === 'none';
        hideAllFloatingElements();
        if (show) {
            aiFloatingPanel.style.display = 'block';
            aiFloatingPanel.style.left = '50%';
            aiFloatingPanel.style.top = '40%';
            aiFloatingPanel.style.transform = 'translate(-50%, -50%)';
        }
    });

    closeAiPanelBtn?.addEventListener('click', () => {
        aiFloatingPanel.style.display = 'none';
    });

    function hideAllFloatingElements() {
        if (bgPopover) bgPopover.style.display = 'none';
        if (filesFloatingPanel) filesFloatingPanel.style.display = 'none';
        if (aiFloatingPanel) aiFloatingPanel.style.display = 'none';
    }

    // Check if board has no widgets
    function checkDesktopEmpty() {
        const widgets = bureauDesktop.querySelectorAll('.widget-instance');
        const drawingVisible = wDrawing.style.display === 'block';
        if (widgets.length === 0 && !drawingVisible) {
            bureauPlaceholderInfo.style.display = 'block';
        } else {
            bureauPlaceholderInfo.style.display = 'none';
        }
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        try {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("[Teacher] WebSocket Connected");
                socket.send(JSON.stringify({
                    type: 'join',
                    session: sessionCode,
                    role: 'teacher'
                }));
                
                syncBackground(backgroundStyle);
                window.showToast("Diffusion en direct activée ! ✓");
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'request-sync') {
                    syncDesktopState();
                    syncBackground(backgroundStyle);
                }
            };

            socket.onclose = () => {
                console.log("[Teacher] WebSocket Closed");
            };

        } catch (e) {
            console.error("Failed connection to WebSocket:", e);
            alert("Erreur de connexion au serveur de diffusion.");
        }
    }

    function syncDesktopState() {
        if (socket && socket.readyState === 1) {
            const dataPayload = [...activeWidgets];
            if (drawingPaths.length > 0) {
                dataPayload.push({
                    type: 'drawing-data',
                    data: drawingPaths
                });
            }
            socket.send(JSON.stringify({
                type: 'sync-desktop',
                widgets: dataPayload
            }));
        }
    }

    function syncBackground(bg) {
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'sync-background',
                background: bg
            }));
        }
    }

    copyShareLinkBtn?.addEventListener('click', () => {
        const link = `${window.location.origin}/?session=${sessionCode}`;
        navigator.clipboard.writeText(link)
            .then(() => window.showToast("Lien élève copié ! ✓"))
            .catch(() => alert("Impossible de copier le lien."));
    });

    showSessionQrBtn?.addEventListener('click', () => {
        const shareUrl = `${window.location.origin}/?session=${sessionCode}`;
        sessionQrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
        sessionQrCodeLabel.textContent = `${sessionCode.substring(0, 3)} ${sessionCode.substring(3)}`;
        sessionQrLinkUrl.textContent = shareUrl;
        sessionQrModal.classList.add('show');
    });

    const closeQrModal = () => sessionQrModal?.classList.remove('show');
    closeSessionQrModalBtn?.addEventListener('click', closeQrModal);
    sessionQrModalCloseArea?.addEventListener('click', closeQrModal);

    // ─── WIDGET FACTORY & DRAG-RESIZE LOGIC ───
    function createWidget(type, title, defaultContent) {
        bureauPlaceholderInfo.style.display = 'none';

        const id = `${type}-${Math.random().toString(36).substring(2, 9)}`;
        const w = {
            id: id,
            type: type,
            title: title,
            content: defaultContent,
            x: 20 + (activeWidgets.length * 5) % 40, // offset cascades
            y: 20 + (activeWidgets.length * 5) % 40,
            width: type === 'timer' ? 220 : 250,
            height: type === 'timer' ? 120 : 180,
            bgColor: type === 'postit' ? '#fef08a' : 'var(--surface)',
            color: '#7c3aed'
        };

        if (type === 'timer') {
            w.secondsLeft = 300; // 5 mins default
        }

        activeWidgets.push(w);
        renderWidgetOnTeacherDesktop(w);
        syncDesktopState();
    }

    function removeWidgetsOfType(type) {
        activeWidgets = activeWidgets.filter(w => {
            if (w.type === type) {
                const el = document.getElementById(w.id);
                el?.remove();
                return false;
            }
            return true;
        });
        checkDesktopEmpty();
        syncDesktopState();
    }

    function renderWidgetOnTeacherDesktop(w) {
        const el = document.createElement('div');
        el.id = w.id;
        el.className = `widget-instance widget-${w.type}`;
        el.style.left = `${w.x}%`;
        el.style.top = `${w.y}%`;
        el.style.width = `${w.width}px`;
        el.style.height = `${w.height}px`;
        el.style.backgroundColor = w.bgColor;
        el.style.borderColor = w.color;

        // Custom widget drag handle and close button
        let dragBar = document.createElement('div');
        dragBar.className = 'widget-drag-handle';
        dragBar.innerHTML = `<span class="widget-title">${w.title}</span> <button class="btn-close-widget">×</button>`;
        el.appendChild(dragBar);

        // Close button click
        dragBar.querySelector('.btn-close-widget').addEventListener('click', (e) => {
            e.stopPropagation();
            el.remove();
            activeWidgets = activeWidgets.filter(x => x.id !== w.id);
            
            // Turn off checkbox if that was the last widget of that type
            const hasMoreOfThisType = activeWidgets.some(x => x.type === w.type);
            if (!hasMoreOfThisType) {
                const toggle = document.getElementById(`toggle-w-${w.type}`);
                if (toggle) toggle.checked = false;
            }
            checkDesktopEmpty();
            syncDesktopState();
        });

        // Widget content block
        let contentEl = document.createElement('div');
        contentEl.className = 'widget-content-body';
        el.appendChild(contentEl);

        setupWidgetInnerUI(w, contentEl);

        // Make Draggable & Resizable
        makeDraggable(el, dragBar, w);
        makeResizable(el, w);

        bureauDesktop.appendChild(el);
    }

    function setupWidgetInnerUI(w, container) {
        if (w.type === 'postit') {
            container.innerHTML = `<div class="postit-text" contenteditable="true">${w.content}</div>`;
            const textEl = container.querySelector('.postit-text');
            textEl.addEventListener('input', () => {
                w.content = textEl.innerText;
                syncDesktopState();
            });
        } else if (w.type === 'text') {
            container.innerHTML = `<div class="widget-text-editor" contenteditable="true">${w.content}</div>`;
            const textEl = container.querySelector('.widget-text-editor');
            textEl.addEventListener('input', () => {
                w.content = textEl.innerHTML;
                syncDesktopState();
            });
        } else if (w.type === 'qrcode') {
            container.innerHTML = `<div class="qrcode-content"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(w.content)}" alt="QR Code"><p class="qr-label">${w.content}</p></div>`;
        } else if (w.type === 'video') {
            const url = w.content;
            if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
                container.innerHTML = `<iframe src="${url}" frameborder="0" allowfullscreen style="width:100%; height:calc(100% - 24px);"></iframe>`;
            } else {
                container.innerHTML = `<video src="${url}" controls style="max-width:100%; max-height:calc(100% - 24px);"></video>`;
            }
        } else if (w.type === 'iframe') {
            container.innerHTML = `<iframe src="${w.content}" frameborder="0" style="width:100%; height:calc(100% - 24px);"></iframe>`;
        } else if (w.type === 'timer') {
            // Initialize timer intervals
            let timerInterval = null;
            
            const renderClock = () => {
                const mins = Math.floor(w.secondsLeft / 60).toString().padStart(2, '0');
                const secs = (w.secondsLeft % 60).toString().padStart(2, '0');
                container.innerHTML = `
                    <div class="timer-controls">
                        <span class="clock-display">⏱️ ${mins}:${secs}</span>
                        <div class="timer-actions">
                            <button class="btn btn-secondary btn-sm" id="btn-start-clock">▶</button>
                            <button class="btn btn-secondary btn-sm" id="btn-pause-clock" style="display:none;">⏸</button>
                            <button class="btn btn-secondary btn-sm" id="btn-reset-clock">🔄</button>
                        </div>
                    </div>
                    <input type="text" class="timer-title-input" value="${w.content}" placeholder="Titre de l'activité">
                `;

                const startBtn = container.querySelector('#btn-start-clock');
                const pauseBtn = container.querySelector('#btn-pause-clock');
                const resetBtn = container.querySelector('#btn-reset-clock');
                const labelInput = container.querySelector('.timer-title-input');

                if (timerInterval) {
                    startBtn.style.display = 'none';
                    pauseBtn.style.display = 'inline-flex';
                }

                labelInput.addEventListener('input', () => {
                    w.content = labelInput.value;
                    syncDesktopState();
                });

                startBtn.addEventListener('click', () => {
                    if (timerInterval) return;
                    startBtn.style.display = 'none';
                    pauseBtn.style.display = 'inline-flex';
                    
                    timerInterval = setInterval(() => {
                        if (w.secondsLeft > 0) {
                            w.secondsLeft--;
                            syncDesktopState();
                            // Update clock locally
                            const m = Math.floor(w.secondsLeft / 60).toString().padStart(2, '0');
                            const s = (w.secondsLeft % 60).toString().padStart(2, '0');
                            container.querySelector('.clock-display').textContent = `⏱️ ${m}:${s}`;
                        } else {
                            clearInterval(timerInterval);
                            timerInterval = null;
                            startBtn.style.display = 'inline-flex';
                            pauseBtn.style.display = 'none';
                            // Play bell sound
                            playTimerAlert();
                            syncDesktopState();
                        }
                    }, 1000);
                });

                pauseBtn.addEventListener('click', () => {
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                    startBtn.style.display = 'inline-flex';
                    pauseBtn.style.display = 'none';
                });

                resetBtn.addEventListener('click', () => {
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                    const minutesStr = prompt("Régler le minuteur (en minutes) :", "5");
                    const minutesVal = parseInt(minutesStr);
                    w.secondsLeft = !isNaN(minutesVal) ? minutesVal * 60 : 300;
                    renderClock();
                    syncDesktopState();
                });
            };

            renderClock();
        }
    }

    function playTimerAlert() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 1.2);
        } catch (e) {
            console.warn("Could not play sound", e);
        }
    }

    // Draggable helper
    function makeDraggable(el, handle, widgetData) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            // Only drag on left click
            if (e.button !== 0) return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            // Calculate new position
            let newX = el.offsetLeft - pos1;
            let newY = el.offsetTop - pos2;

            // Clamp inside desktop limits
            const maxLeft = bureauDesktop.clientWidth - el.clientWidth;
            const maxTop = bureauDesktop.clientHeight - el.clientHeight;
            newX = Math.max(0, Math.min(newX, maxLeft));
            newY = Math.max(0, Math.min(newY, maxTop));

            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;

            // Convert to percentages for responsiveness
            widgetData.x = (newX / bureauDesktop.clientWidth) * 100;
            widgetData.y = (newY / bureauDesktop.clientHeight) * 100;
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            // Broadcast state on release
            syncDesktopState();
        }
    }

    // Resizable helper
    function makeResizable(el, widgetData) {
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
            
            newWidth = Math.max(120, Math.min(newWidth, 600));
            newHeight = Math.max(80, Math.min(newHeight, 500));

            el.style.width = `${newWidth}px`;
            el.style.height = `${newHeight}px`;

            widgetData.width = newWidth;
            widgetData.height = newHeight;
        }

        function stopResize() {
            window.removeEventListener('mousemove', startResize, false);
            window.removeEventListener('mouseup', stopResize, false);
            syncDesktopState();
        }
    }


    // ─── DRAWING CANVAS LOGIC ───
    function initDrawingCanvas() {
        const canvas = drawingCanvas;
        if (!canvas) return;

        // Fit canvas to screen dimensions
        if (canvas.width !== bureauDesktop.clientWidth || canvas.height !== bureauDesktop.clientHeight) {
            canvas.width = bureauDesktop.clientWidth;
            canvas.height = bureauDesktop.clientHeight;
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        canvas.addEventListener('touchend', () => {
            const mouseEvent = new MouseEvent('mouseup', {});
            window.dispatchEvent(mouseEvent);
        });
    }

    function startDrawing(e) {
        const canvas = drawingCanvas;
        const rect = canvas.getBoundingClientRect();
        isDrawing = true;

        const xPx = e.clientX - rect.left;
        const yPx = e.clientY - rect.top;

        // Store relative coordinate (percentage) to sync across all window sizes
        const xPct = (xPx / canvas.width) * 100;
        const yPct = (yPx / canvas.height) * 100;

        currentStroke = {
            color: drawColorPicker.value,
            width: parseInt(drawSizeSlider.value),
            points: [{ x: xPct, y: yPct }]
        };

        drawingPaths.push(currentStroke);
    }

    function draw(e) {
        if (!isDrawing || !currentStroke) return;
        const canvas = drawingCanvas;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const xPx = e.clientX - rect.left;
        const yPx = e.clientY - rect.top;
        const xPct = (xPx / canvas.width) * 100;
        const yPct = (yPx / canvas.height) * 100;

        // Draw locally in real-time
        ctx.beginPath();
        ctx.strokeStyle = currentStroke.color;
        ctx.lineWidth = currentStroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Redraw current stroke path
        const lastPoint = currentStroke.points[currentStroke.points.length - 1];
        const lastX = (lastPoint.x / 100) * canvas.width;
        const lastY = (lastPoint.y / 100) * canvas.height;

        ctx.moveTo(lastX, lastY);
        ctx.lineTo(xPx, yPx);
        ctx.stroke();

        // Save point coordinates
        currentStroke.points.push({ x: xPct, y: yPct });
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            currentStroke = null;
            // Broadcast drawing updates to students
            syncDesktopState();
        }
    }

    clearCanvasBtn?.addEventListener('click', () => {
        clearCanvas();
        drawingPaths = [];
        syncDesktopState();
    });

    function clearCanvas() {
        const canvas = drawingCanvas;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function redrawCanvas() {
        const canvas = drawingCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawingPaths.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 2) return;
            
            ctx.beginPath();
            ctx.strokeStyle = stroke.color || '#ff0000';
            ctx.lineWidth = stroke.width || 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
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

    // ─── BACKGROUND CONFIGURATION ───
    bgOptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            bgOptBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            backgroundStyle = btn.getAttribute('data-bg');
            applyBackgroundLocal(backgroundStyle);
            syncBackground(backgroundStyle);
        });
    });

    function applyBackgroundLocal(bg) {
        bureauDesktop.style.backgroundImage = 'none';
        bureauDesktop.style.backgroundColor = 'var(--surface)';

        if (bg === 'blackboard') {
            bureauDesktop.style.backgroundColor = '#162e20';
            bureauDesktop.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(25,60,35,0.8) 0%, rgba(10,30,15,1) 100%)';
        } else if (bg === 'grid') {
            bureauDesktop.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)';
            bureauDesktop.style.backgroundSize = '20px 20px';
        } else if (bg === 'seyes') {
            bureauDesktop.style.backgroundImage = 'linear-gradient(#e6f0fa 1px, transparent 1px), linear-gradient(90deg, #e6f0fa 1px, transparent 1px)';
            bureauDesktop.style.backgroundSize = '10px 10px';
        } else if (bg === 'white') {
            bureauDesktop.style.backgroundColor = '#ffffff';
        } else {
            bureauDesktop.style.backgroundColor = 'var(--bg)';
        }
    }


    // ─── SPEECH TRANSCRIPTION LOGIC (WEB SPEECH API) ───
    clearTranscriptBtn.addEventListener('click', () => {
        liveTranscriptTextarea.value = '';
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'sync-transcript',
                text: '',
                isFinal: true
            }));
        }
    });

    function startLiveSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("La reconnaissance vocale en direct n'est pas disponible sur ce navigateur. Essayez Chrome ou Safari.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

        isRecordingSpeech = true;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentVal = liveTranscriptTextarea.value.trim();
            const spacer = currentVal ? ' ' : '';
            
            if (finalTranscript) {
                // Sentence is fully parsed, append to text box
                liveTranscriptTextarea.value = currentVal + spacer + finalTranscript;
                liveTranscriptTextarea.scrollTop = liveTranscriptTextarea.scrollHeight;

                // Sync finalized transcript to student
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({
                        type: 'sync-transcript',
                        text: liveTranscriptTextarea.value,
                        isFinal: true
                    }));
                }
            } else if (interimTranscript) {
                // Interim text, send preview to student
                const previewText = currentVal + spacer + interimTranscript;
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({
                        type: 'sync-transcript',
                        text: previewText,
                        isFinal: false
                    }));
                }
            }
        };

        recognition.onend = () => {
            if (isRecordingSpeech) {
                // Auto restart if it cuts off randomly
                recognition.start();
            }
        };

        recognition.onerror = (e) => {
            console.error("Speech Recognition Error:", e);
        };

        recognition.start();
    }

    function stopLiveSpeechRecognition() {
        isRecordingSpeech = false;
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
    }

    // ─── AUDIO FILE RECORDER FOR ALBERT WHISPER ───
    async function startVoiceRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioRecorder = new MediaRecorder(stream);
            audioChunks = [];

            audioRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };

            audioRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                // Read to Base64 to upload later
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onload = () => {
                    base64AudioData = reader.result.split('base64,')[1];
                    console.log("[Teacher] Voice audio recorded and ready for Whisper (base64).");
                };
                
                // Release mic
                stream.getTracks().forEach(t => t.stop());
            };

            audioRecorder.start();
            audioRecordStartTime = Date.now();
            
            // Timer ticking
            audioTimerInterval = setInterval(() => {
                const seconds = Math.floor((Date.now() - audioRecordStartTime) / 1000);
                const m = Math.floor(seconds / 60).toString().padStart(2, '0');
                const s = (seconds % 60).toString().padStart(2, '0');
                if (floatingRecordTimer) floatingRecordTimer.textContent = `${m}:${s}`;
            }, 1000);

        } catch (err) {
            console.error("Failed to start voice recorder:", err);
        }
    }

    function stopVoiceRecording() {
        if (audioRecorder && audioRecorder.state !== 'inactive') {
            audioRecorder.stop();
            clearInterval(audioTimerInterval);
            audioTimerInterval = null;
        }
    }


    // ─── FILE UPLOAD & TEXT EXTRACTION ───
    bureauDropZone?.addEventListener('click', () => bureauFileInput?.click());
    
    bureauFileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleBureauFiles(e.target.files);
    });

    if (bureauDropZone) {
        ['dragenter', 'dragover'].forEach(name => {
            bureauDropZone.addEventListener(name, (e) => { e.preventDefault(); bureauDropZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(name => {
            bureauDropZone.addEventListener(name, (e) => { e.preventDefault(); bureauDropZone.classList.remove('drag-over'); });
        });
        bureauDropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) handleBureauFiles(e.dataTransfer.files);
        });
    }

    async function handleBureauFiles(files) {
        bureauFilesList.style.display = 'block';
        bureauDropZoneContent.style.display = 'none';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Render file card
            const item = document.createElement('div');
            item.className = 'bureau-file-item';
            item.innerHTML = `📄 <span class="file-name">${file.name}</span> <span class="file-status">Lecture...</span>`;
            bureauFilesList.appendChild(item);

            try {
                let fileText = "";
                if (file.type === 'application/pdf') {
                    fileText = await extractPdfText(file);
                } else if (file.name.endsWith('.docx')) {
                    fileText = await extractDocxText(file);
                } else {
                    throw new Error("Format non géré.");
                }

                item.querySelector('.file-status').textContent = `✓ (${fileText.length} car.)`;
                item.querySelector('.file-status').className = 'file-status status-success';
                
                // Save text
                uploadedFiles.push({ name: file.name, text: fileText });
                
                // Add widget representing the file to students
                createWidget('file', 'Document partagé', file.name);

            } catch (err) {
                console.error(err);
                item.querySelector('.file-status').textContent = "Erreur";
                item.querySelector('.file-status').className = 'file-status status-error';
            }
        }

        // Recompile all texts
        extractedDocsText = uploadedFiles.map(f => `DOCUMENT [${f.name}] :\n"""\n${f.text}\n"""`).join('\n\n');
    }

    // PDF extraction using window.pdfjsLib loaded from index.html CDN
    function extractPdfText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const typedarray = new Uint8Array(reader.result);
                try {
                    const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + "\n";
                    }
                    resolve(fullText.trim());
                } catch (err) { reject(err); }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    // DOCX extraction using Mammoth loaded from index.html CDN
    function extractDocxText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    resolve(result.value);
                } catch (err) { reject(err); }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }


    // ─── AI DOCS GENERATION (ALBERT) ───
    generateCuaDocBtn?.addEventListener('click', async () => {
        const transcriptText = liveTranscriptTextarea.value.trim();
        const filesText = extractedDocsText.trim();

        if (!transcriptText && !filesText) {
            alert("Veuillez d'abord enregistrer du discours oral ou déposer un fichier support.");
            return;
        }

        generateCuaDocBtn.disabled = true;
        generateCuaDocBtn.textContent = "Génération IA... ⏳";
        
        teacherDocOutputPanel.style.display = 'block';
        aiDocSkeleton.style.display = 'block';
        aiDocOutput.innerHTML = '';
        teacherDocOutputPanel.scrollIntoView({ behavior: 'smooth' });

        const selectedFormat = cuaDocFormatSelect.value;
        
        // Let's check if we have a recorded audio that needs Albert Whisper first
        let activeTranscript = transcriptText;
        if (base64AudioData && !transcriptText) {
            try {
                aiDocOutput.innerHTML = `<span style="font-style:italic;">Calcul d'une transcription audio de haute précision (Albert Whisper)... 🎙️</span>`;
                activeTranscript = await runWhisperTranscription(base64AudioData);
                liveTranscriptTextarea.value = activeTranscript;
                aiDocOutput.innerHTML = '';
            } catch (err) {
                console.error("Whisper failed, using fallback:", err);
                aiDocOutput.innerHTML = '';
            }
        }

        // Build CUA prompt
        const prompt = constructCuaPrompt(activeTranscript, filesText, selectedFormat);

        let fullContent = "";
        try {
            await makeStreamingRequest(prompt, {
                tool: 'professor', // Maps config and proxies to Albert Small
                provider: 'albert',
                model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
            }, (chunk) => {
                aiDocSkeleton.style.display = 'none';
                fullContent += chunk;
                if (window.marked) {
                    aiDocOutput.innerHTML = window.marked.parse(fullContent);
                } else {
                    aiDocOutput.textContent = fullContent;
                }
            }, (complete) => {
                generateCuaDocBtn.disabled = false;
                generateCuaDocBtn.textContent = "🔮 Générer le support de cours";
                window.showToast("Document généré avec succès ! ✓");

                // Render mindmap if format is mermaid
                if (selectedFormat === 'mindmap' && window.mermaid) {
                    window.mermaid.init(undefined, aiDocOutput.querySelectorAll('.language-mermaid'));
                }

                // Save latest doc
                const titles = {
                    fiche: "Fiche de préparation CUA",
                    eleve: "Support élève simplifié (FALC)",
                    mindmap: "Carte Mentale conceptuelle",
                    todo: "Checklist de tâches (TDAH)"
                };
                
                latestGeneratedDoc = {
                    id: `doc-${Math.random().toString(36).substring(2, 9)}`,
                    title: titles[selectedFormat] || "Support de cours",
                    content: complete,
                    type: selectedFormat
                };
                generatedDocTitle.textContent = latestGeneratedDoc.title;

            }, (err) => {
                console.error(err);
                aiDocSkeleton.style.display = 'none';
                aiDocOutput.innerHTML = `<span class="status-error">Erreur lors de la génération : ${err.message}</span>`;
                generateCuaDocBtn.disabled = false;
                generateCuaDocBtn.textContent = "🔮 Générer le support de cours";
            });
        } catch (e) {
            console.error(e);
            aiDocSkeleton.style.display = 'none';
            generateCuaDocBtn.disabled = false;
            generateCuaDocBtn.textContent = "🔮 Générer le support de cours";
        }
    });

    async function runWhisperTranscription(base64) {
        // Send base64 to Albert Whisper using makeStreamingRequest trigger format
        return new Promise((resolve, reject) => {
            let transcriptionResult = "";
            makeStreamingRequest("", {
                provider: 'albert',
                url: (window.location.origin) + '/proxy-albert/v1',
                apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
                model: 'openai/whisper-large-v3',
                resolvedType: 'openai',
                images: [base64] // API helper wraps images parameter for audio payloads to Whisper
            }, (chunk) => {
                transcriptionResult = chunk;
            }, (complete) => {
                resolve(complete);
            }, (err) => {
                reject(err);
            });
        });
    }

    function constructCuaPrompt(transcript, documents, format) {
        let base = `Tu es un expert en ingénierie pédagogique inclusive et en Conception Universelle des Apprentissages (CUA/UDL).
Ta mission est de concevoir un document de cours à partir des éléments de contexte fournis ci-dessous.

CONTEXTE CONJOINT :
${transcript ? `TRANSCRIPTION DU COURS ORAL :\n"""\n${transcript}\n"""\n` : ''}
${documents ? `DOCUMENTS ÉCRITS FOURNIS :\n"""\n${documents}\n"""\n` : ''}

FORMAT DE SORTIE ATTENDU : ${format}
`;

        if (format === 'fiche') {
            base += `\nProduis une Fiche de Préparation / Mise en Œuvre pédagogique structurée pour l'enseignant, comprenant :
1. Objectifs clés du cours.
2. Déroulement chronologique détaillé de la séance.
3. Différenciation CUA par pilier : Propose des variantes spécifiques et concrètes pour les élèves DYS, TDAH ou Allophones.
4. Matériels et supports nécessaires.`;
        } else if (format === 'eleve') {
            base += `\nProduis un Support Élève épuré. Rédige en Français Facile à Lire et à Comprendre (FALC) :
- Utilise un langage simple, des phrases courtes et directes.
- Mets les mots-clés importants en gras (**mots-clés**).
- Sépare bien les paragraphes et évite les explications trop denses.`;
        } else if (format === 'mindmap') {
            base += `\nProduis une carte mentale conceptuelle au format Mermaid.js (graph TD).
CONSIGNES STRICTES POUR MERMAID :
1. Utilise uniquement la syntaxe "graph TD" ou "graph LR".
2. Entoure obligatoirement TOUS les textes des nœuds par des guillemets doubles (ex: A["Texte"]) pour éviter les erreurs de caractères spéciaux.
3. Ne mets aucun commentaire ou explication dans le bloc Mermaid.
4. Ajoute une brève explication textuelle du schéma juste en dessous.`;
        } else if (format === 'todo') {
            base += `\nDécoupe l'activité principale présentée dans le cours en une liste de micro-étapes (check-list simple) pour guider un élève ayant un trouble des fonctions exécutives (TDAH). Chaque étape doit être extrêmement courte et activable (consigne directe).`;
        }

        base += `\nRéponds en français. Utilise le format de balisage Markdown pour la structure. Ne mets pas de commentaires personnels introductifs ou conclusifs.`;
        return base;
    }

    // Broadcast generated document to student screens
    broadcastDocBtn?.addEventListener('click', () => {
        if (!latestGeneratedDoc) return;
        
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'sync-document',
                document: latestGeneratedDoc
            }));
            window.showToast("Document diffusé aux élèves ! 📢");
        } else {
            alert("Aucune session de diffusion active. Démarrez d'abord le partage.");
        }
    });

    closeDocOutputBtn?.addEventListener('click', () => {
        teacherDocOutputPanel.style.display = 'none';
        latestGeneratedDoc = null;
    });
}
