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
      
      if (!currentTranscription || currentTranscription.trim() === '') {
        alert("Veuillez d'abord analyser un enregistrement audio à l'étape 1 pour générer vos cartes et documents.");
        return;
      }

      docBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      docOutputContainer.style.display = 'flex';
      docSkeleton.style.display = 'flex';
      docOutput.style.display = 'none';
      docOutput.textContent = '';
      
      let docPrompt = '';
      if (docType === 'resume') {
        docPrompt = `Fais un résumé clair, concis et exhaustif de la transcription suivante en quelques paragraphes structurés avec des puces.`;
      } else if (docType === 'fiche') {
        docPrompt = `Crée une fiche de synthèse pédagogique structurée (style CUA) à partir de la transcription suivante.
Organise-la avec des titres (H2, H3), des encadrés "Points Clés", "Vocabulaire essentiel" et "Ce qu'il faut retenir".`;
      } else if (docType === 'mindmap_radial') {
        docPrompt = `Génère une CARTE MENTALE RADIALE ÉPURÉE ET AÉRÉE au format Mermaid mindmap basée sur la transcription.
CONSIGNES STRICTES DE CLARTÉ PÉDAGOGIQUE (CUA) :
1. Démarre STRICTEMENT par le mot-clé "mindmap".
2. Définis un nœud central root((Sujet Principal)) avec 2 mots max.
3. 3 à 5 branches principales maximum (Niveau 1 : Thèmes).
4. Chaque feuille (Niveau 2 ou 3) doit être ULTRA-CONCISE (1 à 4 mots max).
5. N'utilise JAMAIS de parenthèses brutes à l'intérieur des noms.
6. Entoure les textes par des guillemets doubles [\"Texte court\"].

Exemple strict :
\`\`\`mermaid
mindmap
  root((Intelligence Artificielle))
    Recherche
      Poe["Agrégateur de modèles"]
      Perplexity["Recherche avec sources"]
    Création Visuelle
      Midjourney["Style artistique"]
      DALL-E 3["Descriptions fines"]
    Audio
      Suno["Chansons complètes"]
      Vidnose["Musique de fond"]
\`\`\`
Réponds UNIQUEMENT avec le bloc de code Mermaid, sans texte avant ni après.`;
      } else if (docType === 'mindmap_blocks') {
        docPrompt = `Génère un DIAGRAMME EN BOÎTES THÉMATIQUES HORIZONTALES (graph LR avec Subgraphs) basé sur la transcription.
CONSIGNES STRICTES DE CLARTÉ PÉDAGOGIQUE (CUA) :
1. Démarre STRICTEMENT par "graph LR".
2. Regroupe les notions par sous-domaines dans des "subgraph G1 [\"Titre\"]" distincts (3 ou 4 subgraphs max).
3. Dans chaque boîte, place 2 ou 3 cartes concises (ex: A[\"Nom : Rôle court\"]).
4. Crée des liens logiques clairs entre les sous-graphes ou les notions.
5. Entoure TOUS les textes par des guillemets doubles [\"...\"] pour éviter toute erreur.

Exemple :
\`\`\`mermaid
graph LR
  subgraph G1 ["🔍 Recherche & Info"]
    A1["Poe : Comparateur"]
    A2["Perplexity : Sources fiables"]
  end
  subgraph G2 ["🎨 Création Visuelle"]
    B1["Midjourney : Artistique"]
    B2["DALL-E 3 : Description texte"]
  end
  subgraph G3 ["🎵 Audio & Musique"]
    C1["Suno : Chansons"]
    C2["Vidnose : Ambiance libre"]
  end
  G1 --> G2 --> G3
\`\`\`
Réponds UNIQUEMENT avec le bloc de code Mermaid, sans texte avant ni après.`;
      } else if (docType === 'mindmap_tiles') {
        docPrompt = `Tu es un expert en Conception Universelle de l'Apprentissage (CUA).
Génère une grille de TUILES CONCEPTUELLES INTERACTIVES au format HTML à partir de la transcription.

Chaque tuile représente un concept ou outil clé du cours avec :
- Un titre clair avec emoji
- Une catégorie (badge)
- Une explication simple en 1 phrase (FALC)
- Un exemple parlant du quotidien dans un bloc déroulant <details>

Format HTML STRICT :
<div class="cua-interactive-grid">
  <div class="cua-tile-card">
    <div class="cua-tile-header">
      <span class="cua-tile-badge">Recherche</span>
      <h3 class="cua-tile-title">🔍 Perplexity AI</h3>
    </div>
    <p class="cua-tile-desc">Moteur de recherche qui vérifie et cite ses sources fiables.</p>
    <details class="cua-tile-details">
      <summary>💡 Exemple concret</summary>
      <div class="cua-tile-example">Idéal pour vérifier une date ou trouver un article scientifique sourcé pour un exposé.</div>
    </details>
  </div>
</div>

Génère 4 à 6 tuiles maximum. Réponds UNIQUEMENT par le code HTML brut (sans \`\`\`html).`;
      } else if (docType === 'mindmap_step') {
        docPrompt = `Génère un SCHÉMA DE PARCOURS LINÉAIRE PAS-À-PAS (graph LR chronologique) basé sur le déroulé de la transcription.
CONSIGNES STRICTES :
1. Démarre par "graph LR".
2. Représente 4 à 6 étapes ordonnées (Étape 1 ➔ Étape 2 ➔ Étape 3...) avec titre et action clé.
3. Utilise des flèches légendées (ex: A -->|Ensuite| B).
4. Textes courts entourés de guillemets doubles.

Exemple :
\`\`\`mermaid
graph LR
  E1["1. Définir le besoin"] -->|Étape suivante| E2["2. Choisir l'outil IA"]
  E2 -->|Génération| E3["3. Créer le support"]
  E3 -->|Relecture| E4["4. Validation humaine"]
\`\`\`
Réponds UNIQUEMENT avec le bloc de code Mermaid.`;
      } else if (docType === 'mindmap_matrix') {
        docPrompt = `Génère une MATRICE CONCEPTUELLE SKETCHNOTE sous forme de tableau Markdown structuré en 3 colonnes à partir de la transcription.

Format attendu :
| 💡 Notion / Outil Clé | 📖 Ce que c'est (FALC en 1 phrase) | 🎯 Exemple concret du quotidien |
| :--- | :--- | :--- |
| **Poe** | Agrégateur permettant de tester plusieurs IA au même endroit. | Comme une télécommande universelle pour changer de modèle. |
| **Suno AI** | Générateur qui compose musique et paroles à partir d'un texte. | Créer une chanson d'anniversaire personnalisée en 30 secondes. |

Règles :
- 5 à 7 lignes maximum pour une lisibilité parfaite.
- Ton simple, accessible, imagé (CUA).
- Pas de jargon complexe.`;
      }
      
      const systemPrompt = "Tu es un expert pédagogique en visualisation et Conception Universelle de l'Apprentissage (CUA). Tu dois OBLIGATOIREMENT et STRICTEMENT générer le format de sortie demandé (diagramme Mermaid, code HTML de tuiles ou tableau Markdown). INTERDICTION formelle d'ajouter du texte conversationnel, des salutations, des analyses non sollicitées ou des traductions en anglais. Produis UNIQUEMENT le bloc attendu.";

      const finalPrompt = `TRANSCRIPTION AUDIO :\n"""\n${currentTranscription}\n"""\n\nCONSIGNE DE SORTIE :\n${docPrompt}\n\nIMPORTANT: Produis UNIQUEMENT le contenu demandé ci-dessus. Pas d'introduction, pas de conclusion, pas de traduction.`;

      const requestOptions = {
        tool: 'professor',
        systemPrompt: systemPrompt
      };

      makeStreamingRequest(finalPrompt, requestOptions, (chunk, full) => {
        docSkeleton.style.display = 'none'; docOutput.style.display = 'block';
        if (docType === 'mindmap_tiles') {
          // HTML direct rendering
          let cleanHtml = full.replace(/```html/gi, '').replace(/```/g, '').trim();
          docOutput.innerHTML = cleanHtml;
        } else {
          formatMarkdown(docOutput, full);
        }
      }, () => {
        if (window.mermaid && (docType.startsWith('mindmap_') || docType === 'mindmap')) {
          try {
            window.mermaid.run({
              nodes: docOutput.querySelectorAll('.mermaid')
            }).catch(e => console.error("Mermaid run error in Voice AI:", e));
          } catch (e) {}
        }
      }, (err) => {
        docSkeleton.style.display = 'none'; docOutput.style.display = 'block';
        docOutput.innerHTML = `<span style="color: red;">Erreur :</span> ${err.message}`;
      });
    });
  });
}
