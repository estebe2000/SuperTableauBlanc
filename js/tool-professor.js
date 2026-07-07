import { makeStreamingRequest, formatMarkdown } from './api.js';

export function initProfessor() {
  const professorInput = document.getElementById('professorInput');
  const sendConceptBtn = document.getElementById('sendConceptBtn');
  const chatMessages = document.getElementById('chatMessages');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const cuaOptions = document.querySelectorAll('.cua-option');
  
  const courseUploadBtn = document.getElementById('courseUploadBtn');
  const courseFileInput = document.getElementById('courseFileInput');
  const courseBadge = document.getElementById('courseBadge');
  const courseName = document.getElementById('courseName');
  const removeCourseBtn = document.getElementById('removeCourseBtn');

  if (!professorInput || !sendConceptBtn || !chatMessages) {
    console.warn("Professor DOM elements not found, skipping.");
    return;
  }

  let selectedCuaMode = 'simplifie';
  let extractedCourseText = "";
  let activeCourseName = "";

  // Course Upload Logic
  courseUploadBtn?.addEventListener('click', () => courseFileInput.click());

  courseFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Seuls les fichiers PDF sont acceptés.");
      courseFileInput.value = '';
      return;
    }

    try {
      window.showToast("Analyse du PDF... ⏳");
      const reader = new FileReader();
      
      reader.onload = async () => {
        const typedarray = new Uint8Array(reader.result);
        
        try {
          // Use PDF.js to extract text
          const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
          let fullText = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + "\n\n";
          }
          
          extractedCourseText = fullText.trim();
          activeCourseName = file.name;
          courseName.textContent = `Cours : ${file.name}`;
          courseBadge.style.display = 'flex';
          window.showToast("Cours analysé avec succès ! ✓");
          console.log("PDF text extracted, length:", extractedCourseText.length);
        } catch (pdfErr) {
          console.error("PDF.js processing error:", pdfErr);
          alert("Erreur lors de l'analyse du PDF. Le fichier est peut-être protégé ou corrompu.");
        }
      };
      
      reader.readAsArrayBuffer(file);
      
    } catch (err) {
      console.error("Course reading failed:", err);
      alert("Erreur lors de la lecture du fichier.");
    }
  });

  removeCourseBtn?.addEventListener('click', () => {
    extractedCourseText = "";
    activeCourseName = "";
    courseBadge.style.display = 'none';
    courseFileInput.value = '';
    window.showToast("Cours retiré.");
  });

  // CUA Sidebar selection
  cuaOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      cuaOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      
      // Check inner radio button
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        selectedCuaMode = radio.value;
      }
    });
  });

  // Reset chat window
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      chatMessages.innerHTML = `
        <div class="chat-bubble system-message">
            <p>Bonjour ! Quel concept souhaitez-vous comprendre aujourd'hui ? Saisissez une notion ci-dessous et sélectionnez la représentation de votre choix dans le volet de gauche.</p>
        </div>
      `;
      professorInput.value = '';
      window.speechSynthesis.cancel();
    });
  }

  // Text to speech helper
  function speakText(text) {
    window.speechSynthesis.cancel();
    
    // Clean markdown and mermaid syntax to avoid weird reading
    let cleaned = text
      .replace(/```mermaid[\s\S]*?```/gi, ' [Le schéma visuel s\'affiche à l\'écran.] ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/[#*_\-[\]()]+/g, ' ')
      .trim();
      
    if (!cleaned) return;
    
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = 'fr-FR';
    
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') || v.lang.startsWith('FR'));
    if (frVoice) utterance.voice = frVoice;
    
    window.speechSynthesis.speak(utterance);
  }

  // Prompts templates for CUA modes
  const cuaPrompts = {
    simplifie: (concept, courseContent) => {
      const base = `Explique la notion ou le concept de "${concept}" de façon extrêmement simple, pédagogique et facile à lire. Structure ta réponse avec des paragraphes cours et aérés, utilise des listes à puces pour les étapes clés, et mets les mots-clés importants en gras (**mots-clés**).`;
      return courseContent ? `CONTEXTE DE COURS FOURNI :\n"""\n${courseContent}\n"""\n\n${base}\nCONSIGNE : Utilise PRIORITAIREMENT les informations du document ci-dessus pour ton explication.` : base;
    },
    
    metaphore: (concept, courseContent) => {
      const base = `Explique le concept ou la notion de "${concept}" en utilisant uniquement une métaphore ou une analogie concrète de la vie quotidienne pour faciliter sa compréhension par un élève. Rends l'explication vivante et lie chaque élément technique du concept à un élément de la métaphore choisie.`;
      return courseContent ? `CONTEXTE DE COURS FOURNI :\n"""\n${courseContent}\n"""\n\n${base}\nCONSIGNE : Base-toi sur les spécificités du document ci-dessus pour construire ta métaphore.` : base;
    },
    
    schema: (concept, courseContent) => {
      const base = `Crée un schéma conceptuel structuré sous forme de diagramme Mermaid (graph TD) pour représenter visuellement les relations logiques et le fonctionnement de la notion : "${concept}".
  Tu dois UNIQUEMENT générer un bloc de code au format Mermaid.
  
  CONSIGNES SYNTAXIQUES :
  1. Utilise "graph TD" au début du bloc.
  2. Entoure TOUS les textes des noeuds par des guillemets doubles (ex: A["Mon Concept"]) pour éviter les erreurs avec les caractères spéciaux.
  
  Exemple de format :
  \`\`\`mermaid
  graph TD
    A["Concept Principal"] --> B["Sous-concept 1"]
    A --> C["Sous-concept 2"]
  \`\`\`
  N'ajoute aucun texte d'introduction ou de conclusion. Rends le diagramme logique et instructif.`;
      return courseContent ? `CONTEXTE DE COURS FOURNI :\n"""\n${courseContent}\n"""\n\n${base}\nCONSIGNE : Extrais les relations logiques directement du document ci-dessus.` : base;
    },
    
    glossaire: (concept, courseContent) => {
      const base = `Donne une définition globale claire de la notion : "${concept}". Ensuite, dresse une liste de 3 à 5 mots-clés essentiels et indispensables liés à cette notion, en fournissant pour chacun une explication simple, concise et facile à retenir pour un étudiant.`;
      return courseContent ? `CONTEXTE DE COURS FOURNI :\n"""\n${courseContent}\n"""\n\n${base}\nCONSIGNE : Utilise le vocabulaire et les définitions présentes dans le document ci-dessus.` : base;
    }
  };

  const triggerExplanation = () => {
    const concept = professorInput.value.trim();
    if (!concept) {
      alert("Veuillez saisir un concept à expliquer.");
      return;
    }
    
    // Disable inputs
    sendConceptBtn.disabled = true;
    sendConceptBtn.querySelector('.btn-text').textContent = 'Analyse...';
    sendConceptBtn.querySelector('.btn-loader').style.display = 'block';
    professorInput.disabled = true;
    
    // Add user message bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble student';
    userBubble.textContent = extractedCourseText ? `[Basé sur le cours] ${concept}` : concept;
    chatMessages.appendChild(userBubble);
    
    // Add loader bubble
    const loaderBubble = document.createElement('div');
    loaderBubble.className = 'chat-bubble loading-bubble';
    loaderBubble.innerHTML = `
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    chatMessages.appendChild(loaderBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Construct prompt
    const promptFunc = cuaPrompts[selectedCuaMode] || cuaPrompts.simplifie;
    const finalPrompt = promptFunc(concept, extractedCourseText);
    
    let answerText = "";
    
    // Start stream
    makeStreamingRequest(
      finalPrompt, { tool: 'professor' },
      (chunk, full) => {
        // Remove loader bubble if present
        if (loaderBubble.parentNode) {
          loaderBubble.remove();
        }
        
        // Find or create response bubble
        let resBubble = chatMessages.querySelector('.chat-bubble.professor:last-child');
        if (!resBubble || resBubble.dataset.complete === "true") {
          resBubble = document.createElement('div');
          resBubble.className = 'chat-bubble professor';
          chatMessages.appendChild(resBubble);
        }
        
        answerText = full;
        formatMarkdown(resBubble, full);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      () => {
        // Stream completed successfully
        sendConceptBtn.disabled = false;
        sendConceptBtn.querySelector('.btn-text').textContent = 'Expliquer';
        sendConceptBtn.querySelector('.btn-loader').style.display = 'none';
        professorInput.disabled = false;
        professorInput.value = '';
        
        let resBubble = chatMessages.querySelector('.chat-bubble.professor:last-child');
        if (resBubble) {
          resBubble.dataset.complete = "true";
          
          // Add Speak button
          const speakBtn = document.createElement('button');
          speakBtn.className = 'chat-speak-btn';
          speakBtn.title = 'Écouter l\'explication';
          speakBtn.innerHTML = '🔊';
          
          const textToSpeak = answerText;
          speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            speakText(textToSpeak);
          });
          
          resBubble.appendChild(speakBtn);
          
          // Scope mermaid to this bubble only
          if (window.mermaid) {
            window.mermaid.run({
              nodes: resBubble.querySelectorAll('.mermaid')
            }).catch(e => console.error("Mermaid run error:", e));
          }
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      (err) => {
        // Error handling
        if (loaderBubble.parentNode) {
          loaderBubble.remove();
        }
        
        const errBubble = document.createElement('div');
        errBubble.className = 'chat-bubble error-message';
        errBubble.innerHTML = `<strong>Erreur :</strong> ${err.message}`;
        chatMessages.appendChild(errBubble);
        
        sendConceptBtn.disabled = false;
        sendConceptBtn.querySelector('.btn-text').textContent = 'Expliquer';
        sendConceptBtn.querySelector('.btn-loader').style.display = 'none';
        professorInput.disabled = false;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    );
  };

  sendConceptBtn.addEventListener('click', triggerExplanation);
  
  // Enter key trigger (but Shift+Enter makes newline)
  professorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerExplanation();
    }
  });
}
