import { makeStreamingRequest, formatMarkdown } from './api.js';
import { appConfig } from './config.js';

export function initVoice() {
  const audioDropZone = document.getElementById('audioDropZone');
  const audioFileInput = document.getElementById('audioFileInput');
  const audioDropZoneContent = document.getElementById('audioDropZoneContent');
  const audioPreviewContainer = document.getElementById('audioPreviewContainer');
  const audioFileName = document.getElementById('audioFileName');
  const audioPlayer = document.getElementById('audioPlayer');
  const changeAudioBtn = document.getElementById('changeAudioBtn');
  const transcribeBtn = document.getElementById('transcribeBtn');
  const startRecordBtn = document.getElementById('startRecordBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const recordTimer = document.getElementById('recordTimer');

  const transcriptionPanel = document.getElementById('transcriptionPanel');
  const audioCopyBtn = document.getElementById('audioCopyBtn');
  const audioPlaceholder = document.getElementById('audioPlaceholder');
  const audioSkeleton = document.getElementById('audioSkeleton');
  const audioOutput = document.getElementById('audioOutput');

  const documentsPanel = document.getElementById('documentsPanel');
  const docBtns = document.querySelectorAll('.doc-btn');
  const docOutputContainer = document.getElementById('docOutputContainer');
  const docSkeleton = document.getElementById('docSkeleton');
  const docOutput = document.getElementById('docOutput');

  if (!audioDropZone || !audioFileInput || !transcribeBtn) {
    console.warn("Voice AI DOM elements not found, skipping.");
    return;
  }

  let base64Audio = null;
  let currentTranscription = "";
  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let timerInterval = null;

  audioDropZone.addEventListener('click', (e) => {
    // Prevent file dialog if clicking record buttons
    if (e.target.closest('.record-btn')) return;
    if (e.target !== changeAudioBtn && !changeAudioBtn.contains(e.target)) audioFileInput.click();
  });

  // Recording Logic
  startRecordBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const file = new File([audioBlob], "enregistrement_direct.wav", { type: 'audio/wav' });
        handleAudioFile(file);
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      startRecordBtn.style.display = 'none';
      stopRecordBtn.style.display = 'inline-flex';
      
      startTime = Date.now();
      timerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        recordTimer.textContent = `${m}:${s}`;
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Impossible d'accéder au microphone. Veuillez vérifier les permissions.");
    }
  });

  stopRecordBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      clearInterval(timerInterval);
      stopRecordBtn.style.display = 'none';
      startRecordBtn.style.display = 'inline-flex';
    }
  });

  audioFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleAudioFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach(name => {
    audioDropZone.addEventListener(name, (e) => { e.preventDefault(); audioDropZone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(name => {
    audioDropZone.addEventListener(name, (e) => { e.preventDefault(); audioDropZone.classList.remove('drag-over'); });
  });
  audioDropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) handleAudioFile(e.dataTransfer.files[0]);
  });

  changeAudioBtn.addEventListener('click', (e) => {
    e.stopPropagation(); resetAudio();
  });

  async function handleAudioFile(file) {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) { 
      alert('Fichier audio invalide.'); return; 
    }
    audioFileName.textContent = file.name;
    audioDropZoneContent.style.display = 'none';
    audioPreviewContainer.style.display = 'block';
    transcribeBtn.disabled = true;
    transcribeBtn.querySelector('.btn-text').textContent = 'Chargement audio...';
    documentsPanel.style.display = 'none';

    // Show the file in local audio player and load base64
    const reader = new FileReader();
    reader.onload = () => {
      audioPlayer.src = reader.result;
      base64Audio = reader.result.split('base64,')[1];
      transcribeBtn.disabled = false;
      transcribeBtn.querySelector('.btn-text').textContent = 'Transcrire & Identifier';
    };
    reader.onerror = (err) => {
      console.error("Audio reading failed:", err);
      alert("Erreur lors de la lecture du fichier audio.");
      resetAudio();
    };
    reader.readAsDataURL(file);
  }

  function resetAudio() {
    base64Audio = null; audioPlayer.src = '';
    audioPreviewContainer.style.display = 'none'; audioDropZoneContent.style.display = 'flex';
    audioFileInput.value = ''; transcribeBtn.disabled = true;
    documentsPanel.style.display = 'none';
  }

  transcribeBtn.addEventListener('click', () => {
    if (!base64Audio) return;
    transcribeBtn.disabled = true;
    transcribeBtn.querySelector('.btn-text').textContent = 'Analyse en cours...';
    transcribeBtn.querySelector('.btn-loader').style.display = 'block';
    
    audioPlaceholder.style.display = 'none'; audioSkeleton.style.display = 'flex';
    audioOutput.style.display = 'none'; audioOutput.textContent = '';
    audioCopyBtn.disabled = true;
    documentsPanel.style.display = 'none';
    
    const prompt = `RÉPONDS UNIQUEMENT PAR LA TRANSCRIPTION DU DIALOGUE AUDIO.
CONSIGNES STRICTES :
1. INTERDICTION absolue de répéter les mêmes répliques ou de faire des boucles. Suis le flux de l'audio de manière linéaire.
2. Les horodatages doivent être réels, séquentiels et ne jamais dépasser la durée réelle de l'audio.
3. Format requis pour chaque prise de parole : [MM:SS] Nom : Texte (ex: [00:00] Interlocuteur A : ...).
4. Identifie les personnes si leurs noms sont prononcés (ex: Évelyne). Sinon, utilise "Interlocuteur A", "Interlocuteur B".
5. Ne fais aucun commentaire avant ou après la transcription. Pas de réflexions ni d'introduction.`;

    const requestOptions = {
      tool: 'voice',
      images: [base64Audio]
    };
    
    // Override and default to LocalAI 8080's whisper-1 ONLY if active provider is ILaaS
    // (since ILaaS models have no audio encoder tower)
    const toolConf = (appConfig.tools && appConfig.tools.voice) || {};
    const effectiveProvider = toolConf.provider || appConfig.provider;
    const isIlaas = effectiveProvider === 'ilaas';
    if (isIlaas) {
      requestOptions.provider = 'localai8080';
      requestOptions.url = 'http://172.16.87.140:8080/v1';
      requestOptions.apiKey = '';
      requestOptions.model = 'whisper-1';
      requestOptions.resolvedType = 'openai';
    }

    makeStreamingRequest(
      prompt, requestOptions,
      (chunk, full) => {
        audioSkeleton.style.display = 'none'; audioOutput.style.display = 'block';
        
        let cleanFull = full;
        
        if (cleanFull.includes('</thought>')) {
          cleanFull = cleanFull.split('</thought>').pop().trim();
        } else if (cleanFull.includes('<thought>')) {
          cleanFull = '';
        }
        
        if (cleanFull.includes('thought:')) {
          cleanFull = cleanFull.split(/thought:/i).pop().trim();
        }
        
        const firstTimestampIndex = cleanFull.search(/\[\d{2}:\d{2}\]/);
        if (firstTimestampIndex !== -1) {
          cleanFull = cleanFull.substring(firstTimestampIndex);
        } else {
          if (/^(thought|penser|analyse|réflexion|speaker|étape|step)/i.test(cleanFull.trim())) {
            cleanFull = '';
          }
        }
        
        currentTranscription = cleanFull;
        formatMarkdown(audioOutput, cleanFull);
        audioOutput.parentElement.scrollTop = audioOutput.parentElement.scrollHeight;
      },
      () => {
        const toolConf = (appConfig.tools && appConfig.tools.voice) || {};
        const activeModel = requestOptions.model || toolConf.model || appConfig.model || '';
        const isWhisper = activeModel.toLowerCase().includes('whisper');
        
        const completeTranscriptionFlow = () => {
          audioCopyBtn.disabled = false; transcribeBtn.disabled = false;
          transcribeBtn.querySelector('.btn-text').textContent = 'Transcrire & Identifier';
          transcribeBtn.querySelector('.btn-loader').style.display = 'none';
          documentsPanel.style.display = 'block';
        };

        if (isWhisper) {
          // Stage 2: Speaker Diarization using the global active LLM (using 'professor' text model)
          transcribeBtn.querySelector('.btn-text').textContent = 'Identification des voix...';
          
          const diarizationPrompt = `Tu es un expert en traitement de transcriptions.
Voici une transcription brute avec horodatages mais sans identification des interlocuteurs :
${currentTranscription}

Consignes :
1. Identifie les différents interlocuteurs en te basant sur le contexte du dialogue (ex: quand quelqu'un dit "bonjour Evelyne", l'autre personne est Evelyne).
2. Attribue chaque réplique à son interlocuteur sous le format : [MM:SS] Nom : Texte.
3. Si le nom n'est pas identifiable, utilise "Interlocuteur A", "Interlocuteur B", etc.
4. Conserve strictement le sens et les horodatages.
5. Réponds uniquement avec la transcription nettoyée et formatée. Pas d'introduction ni de conclusion.`;

          makeStreamingRequest(
            diarizationPrompt, { tool: 'professor' },
            (chunk, fullDiarized) => {
              let cleanDiarized = fullDiarized;
              if (cleanDiarized.includes('</thought>')) {
                cleanDiarized = cleanDiarized.split('</thought>').pop().trim();
              } else if (cleanDiarized.includes('<thought>')) {
                cleanDiarized = '';
              }
              if (cleanDiarized.includes('thought:')) {
                cleanDiarized = cleanDiarized.split(/thought:/i).pop().trim();
              }
              currentTranscription = cleanDiarized;
              formatMarkdown(audioOutput, cleanDiarized);
              audioOutput.parentElement.scrollTop = audioOutput.parentElement.scrollHeight;
            },
            completeTranscriptionFlow,
            (err) => {
              console.error("Diarization failed:", err);
              completeTranscriptionFlow();
            }
          );
        } else {
          completeTranscriptionFlow();
        }
      },
      (err) => {
        audioSkeleton.style.display = 'none'; audioOutput.style.display = 'block';
        audioOutput.innerHTML = `<span style="color: red;">Erreur lors de l'analyse audio :</span> ${err.message}`;
        transcribeBtn.disabled = false;
        transcribeBtn.querySelector('.btn-text').textContent = 'Transcrire & Identifier';
        transcribeBtn.querySelector('.btn-loader').style.display = 'none';
      }
    );
  });

  audioCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentTranscription).then(() => {
      const original = audioCopyBtn.innerHTML;
      audioCopyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => audioCopyBtn.innerHTML = original, 1500);
    });
  });

  docBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const docType = btn.getAttribute('data-doc');
      
      docBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      docOutputContainer.style.display = 'flex';
      docSkeleton.style.display = 'flex';
      docOutput.style.display = 'none';
      docOutput.textContent = '';
      
      let docPrompt = '';
      if (docType === 'resume') {
        docPrompt = `Fais un résumé clair, concis et exhaustif de la transcription suivante en quelques paragraphes.`;
      } else if (docType === 'fiche') {
        docPrompt = `Crée une fiche de synthèse extrêmement bien structurée à partir de la transcription suivante.
Organise-la avec des titres (H2, H3), des puces, et liste les décisions importantes ou les points clés abordés.`;
      } else if (docType === 'mindmap') {
        docPrompt = `Génère une carte mentale représentant la structure et les idées clés de la transcription suivante sous forme de diagramme Mermaid (graph TD).
IMPORTANT: Ta réponse doit UNIQUEMENT contenir un bloc de code au format Mermaid.

CONSIGNES SYNTAXIQUES :
1. Utilise "graph TD" au début du bloc.
2. Entoure TOUS les textes des noeuds par des guillemets doubles (ex: A["Mon Sujet"]) pour éviter les erreurs avec les caractères spéciaux.

Exemple :
\`\`\`mermaid
graph TD
  A["Sujet principal"] --> B["Sous-sujet 1"]
  A --> C["Sous-sujet 2"]
\`\`\`
N'ajoute aucun commentaire avant ou après le bloc Mermaid.`;
      }
      
      const finalPrompt = `${docPrompt}\n\nTranscription :\n"""\n${currentTranscription}\n"""`;

      makeStreamingRequest(finalPrompt, { tool: 'professor' }, (chunk, full) => {
        docSkeleton.style.display = 'none'; docOutput.style.display = 'block';
        formatMarkdown(docOutput, full);
      }, () => {
        if (window.mermaid) {
          window.mermaid.run({
            nodes: docOutput.querySelectorAll('.mermaid')
          }).catch(e => console.error("Mermaid run error in Voice AI:", e));
        }
      }, (err) => {
        docSkeleton.style.display = 'none'; docOutput.style.display = 'block';
        docOutput.innerHTML = `<span style="color: red;">Erreur :</span> ${err.message}`;
      });
    });
  });
}
