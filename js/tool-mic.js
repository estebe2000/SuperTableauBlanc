export function initMic() {
    const micSessionInput = document.getElementById('micSessionInput');
    const micConnectBtn = document.getElementById('micConnectBtn');
    const micSessionDisplay = document.getElementById('micSessionDisplay');
    const micAuthCard = document.getElementById('micAuthCard');
    const micActiveScreen = document.getElementById('micActiveScreen');
    const micToggleBtn = document.getElementById('micToggleBtn');
    const micTouchIcon = document.getElementById('micTouchIcon');
    const micTouchText = document.getElementById('micTouchText');
    const micLiveDot = document.getElementById('micLiveDot');
    const micVuMeter = document.getElementById('micVuMeter');
    const micTimer = document.getElementById('micTimer');
    const micPreviewContent = document.getElementById('micPreviewContent');
    const micClearPreviewBtn = document.getElementById('micClearPreviewBtn');
    const micPingBoardBtn = document.getElementById('micPingBoardBtn');
    const micPauseBtn = document.getElementById('micPauseBtn');
    const micDisconnectBtn = document.getElementById('micDisconnectBtn');

    if (!micToggleBtn) return;

    let socket = null;
    let sessionCode = "";
    let isRecording = false;
    let recognition = null;
    let timerInterval = null;
    let startTime = null;
    let accumulatedText = "";
    let wakeLock = null;
    let reconnectTimeout = null;
    let shouldAutoReconnect = true;

    // Wake Lock management to prevent mobile phone from locking during lecture
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log("[Remote Mic] Screen Wake Lock active");
            }
        } catch (e) {
            console.warn("[Remote Mic] Wake Lock request error:", e);
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release().catch(() => {});
            wakeLock = null;
            console.log("[Remote Mic] Screen Wake Lock released");
        }
    }

    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible' && isRecording) {
            await requestWakeLock();
        }
    });

    // Check URL parameters for session
    const urlParams = new URLSearchParams(window.location.search);
    const paramSession = urlParams.get('session');
    if (paramSession) {
        sessionCode = paramSession.replace(/\s+/g, '');
        connectToSession(sessionCode);
    } else {
        showAuthScreen();
    }

    function showAuthScreen() {
        if (micAuthCard) micAuthCard.style.display = 'block';
        if (micActiveScreen) micActiveScreen.style.display = 'none';
    }

    function showActiveScreen() {
        if (micAuthCard) micAuthCard.style.display = 'none';
        if (micActiveScreen) micActiveScreen.style.display = 'flex';
        if (micSessionDisplay) micSessionDisplay.textContent = `${sessionCode.substring(0, 3)} ${sessionCode.substring(3)}`;
    }

    micConnectBtn?.addEventListener('click', () => {
        const val = micSessionInput?.value.trim().replace(/\s+/g, '');
        if (!val || val.length < 6) {
            alert("Veuillez saisir un code de session valide à 6 chiffres.");
            return;
        }
        sessionCode = val;
        shouldAutoReconnect = true;
        connectToSession(sessionCode);
    });

    function connectToSession(code) {
        clearTimeout(reconnectTimeout);
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("[Remote Mic] Connected to WS");
                socket.send(JSON.stringify({
                    type: 'join',
                    session: code,
                    role: 'mic'
                }));
                showActiveScreen();
                window.showToast?.("Connecté au tableau ✓");
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'sync-transcript-clear') {
                    accumulatedText = "";
                    if (micPreviewContent) micPreviewContent.textContent = "Texte effacé.";
                }
            };

            socket.onclose = () => {
                console.log("[Remote Mic] WS Disconnected");
                if (shouldAutoReconnect && sessionCode) {
                    console.log("[Remote Mic] Attempting auto-reconnect in 2s...");
                    reconnectTimeout = setTimeout(() => {
                        connectToSession(sessionCode);
                    }, 2000);
                } else {
                    stopRecording();
                    showAuthScreen();
                }
            };

        } catch (e) {
            console.error("[Remote Mic] Connection error:", e);
            if (shouldAutoReconnect && sessionCode) {
                reconnectTimeout = setTimeout(() => connectToSession(sessionCode), 3000);
            }
        }
    }

    // Toggle speech recording
    micToggleBtn?.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    function startRecording() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("La reconnaissance vocale n'est pas supportée par ce navigateur (utilisez Chrome ou Safari sur mobile).");
            return;
        }

        try {
            if (recognition) {
                try { recognition.abort(); } catch (e) {}
            }

            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'fr-FR';

            recognition.onstart = () => {
                isRecording = true;
                requestWakeLock();
                micToggleBtn.classList.add('recording');
                micTouchIcon.textContent = '⏹️';
                micTouchText.textContent = 'Micro Actif (Toucher pour Couper)';
                if (micLiveDot) micLiveDot.style.display = 'inline-block';
                if (micVuMeter) micVuMeter.classList.add('active');

                if (!startTime) startTime = Date.now();
                clearInterval(timerInterval);
                timerInterval = setInterval(updateTimer, 1000);
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        accumulatedText += (accumulatedText ? ' ' : '') + transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const fullText = (accumulatedText + (interimTranscript ? ' ' + interimTranscript : '')).trim();
                if (micPreviewContent) {
                    micPreviewContent.textContent = fullText || "En écoute...";
                    micPreviewContent.scrollTop = micPreviewContent.scrollHeight;
                }

                // Send to board and students
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({
                        type: 'sync-transcript',
                        text: fullText
                    }));
                }
            };

            recognition.onerror = (event) => {
                console.warn("[Remote Mic] Recognition status:", event.error);
                if (event.error === 'not-allowed') {
                    alert("Accès micro refusé. Veuillez autoriser le micro dans les paramètres de votre navigateur mobile.");
                    stopRecording();
                } else if (event.error === 'no-speech' || event.error === 'network') {
                    // Normal during silence or blips, onend will auto-restart
                }
            };

            recognition.onend = () => {
                if (isRecording) {
                    // Resilient auto-restart on silence timeout (seamless continuous loop)
                    setTimeout(() => {
                        if (isRecording && recognition) {
                            try { recognition.start(); } catch (e) {}
                        }
                    }, 200);
                }
            };

            recognition.start();

        } catch (err) {
            console.error("[Remote Mic] Failed to start speech recognition:", err);
            alert("Impossible de démarrer le micro.");
        }
    }

    function stopRecording() {
        isRecording = false;
        releaseWakeLock();
        if (recognition) {
            try { recognition.stop(); } catch (e) {}
            recognition = null;
        }

        clearInterval(timerInterval);
        if (micToggleBtn) {
            micToggleBtn.classList.remove('recording');
            micTouchIcon.textContent = '🎙️';
            micTouchText.textContent = 'Toucher pour Parler';
        }
        if (micLiveDot) micLiveDot.style.display = 'none';
        if (micVuMeter) micVuMeter.classList.remove('active');
    }

    function updateTimer() {
        if (!startTime) return;
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        if (micTimer) micTimer.textContent = `${mins}:${secs}`;
    }

    micClearPreviewBtn?.addEventListener('click', () => {
        accumulatedText = "";
        if (micPreviewContent) micPreviewContent.textContent = "Texte effacé.";
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'sync-transcript',
                text: ''
            }));
        }
    });

    micPingBoardBtn?.addEventListener('click', () => {
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'sync-doubleclick',
                xPercent: 0.5,
                yPercent: 0.4
            }));
            window.showToast?.("🎯 Signal d'attention envoyé au tableau !");
        }
    });

    micPauseBtn?.addEventListener('click', () => {
        stopRecording();
        window.showToast?.("Micro en pause");
    });

    micDisconnectBtn?.addEventListener('click', () => {
        stopRecording();
        if (socket) {
            socket.close();
            socket = null;
        }
        showAuthScreen();
    });
}
