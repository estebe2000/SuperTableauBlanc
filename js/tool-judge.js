import { makeStreamingRequest, formatMarkdown } from './api.js';
import { appConfig } from './config.js';

export function initJudge() {
  const judgeInput = document.getElementById('judgeInput');
  const judgeSubmitBtn = document.getElementById('judgeSubmitBtn');
  const judgePlaceholder = document.getElementById('judgePlaceholder');
  const judgeSkeleton = document.getElementById('judgeSkeleton');
  const judgeResults = document.getElementById('judgeResults');
  
  const judgeAnalysisText = document.getElementById('judgeAnalysisText');
  const judgeResponsePro = document.getElementById('judgeResponsePro');
  const judgeResponseDirect = document.getElementById('judgeResponseDirect');
  const judgeResponseDiplomatic = document.getElementById('judgeResponseDiplomatic');
  const copyBtns = document.querySelectorAll('.copy-suggestion-btn');

  if (!judgeInput || !judgeSubmitBtn || !judgeResults) {
    console.warn("Judge DOM elements not found, skipping initialization.");
    return;
  }

  // Helper to resize textarea automatically
  function resizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + 5) + 'px';
  }

  judgeSubmitBtn.addEventListener('click', () => {
    const text = judgeInput.value.trim();
    if (!text) {
      alert("Veuillez saisir ou coller un message à analyser.");
      return;
    }

    // Disable button & show loader
    judgeSubmitBtn.disabled = true;
    judgeSubmitBtn.querySelector('.btn-text').textContent = 'Analyse en cours...';
    judgeSubmitBtn.querySelector('.btn-loader').style.display = 'block';

    // Show skeleton and hide previous result / placeholder
    judgePlaceholder.style.display = 'none';
    judgeSkeleton.style.display = 'flex';
    judgeResults.style.display = 'none';

    // Reset fields
    judgeAnalysisText.textContent = '';
    judgeResponsePro.value = '';
    judgeResponseDirect.value = '';
    judgeResponseDiplomatic.value = '';
    
    // Set heights to default initially
    judgeResponsePro.style.height = 'auto';
    judgeResponseDirect.style.height = 'auto';
    judgeResponseDiplomatic.style.height = 'auto';

    let promptTemplate = appConfig.prompts?.judge || `Tu es un expert en décryptage des intentions et communication bienveillante.
Analyse le message reçu suivant :
"{text}"

Effectue une analyse rigoureuse :
1. Ton perçu
2. Intention réelle et sous-texte
3. Émotion sous-jacente

Ensuite, propose trois suggestions de réponses distinctes selon cette structure exacte :
### REPONSE_PRO
[Réponse professionnelle et courtoise, polie et axée sur la résolution.]

### REPONSE_DIRECTE
[Réponse neutre, concise et directe.]

### REPONSE_DIPLOMATIQUE
[Réponse diplomatique, calme, visant à désamorcer les tensions.]`;

    let prompt = promptTemplate.replace('{text}', text);
    if (!prompt.includes(text)) {
      prompt += `\n\nMessage à analyser : "${text}"`;
    }

    makeStreamingRequest(
      prompt,
      { tool: 'judge' },
      (chunk, full) => {
        // Hide skeleton and show results
        judgeSkeleton.style.display = 'none';
        judgeResults.style.display = 'block';

        // Robust parsing of analysis and response boxes
        const parsed = parseJudgeResponse(full);

        // 1. Render Markdown analysis
        if (parsed.analysis) {
          formatMarkdown(judgeAnalysisText, parsed.analysis);
        }

        // 2. Populate response textareas
        if (parsed.pro) {
          judgeResponsePro.value = parsed.pro;
          resizeTextarea(judgeResponsePro);
        }
        if (parsed.direct) {
          judgeResponseDirect.value = parsed.direct;
          resizeTextarea(judgeResponseDirect);
        }
        if (parsed.diplo) {
          judgeResponseDiplomatic.value = parsed.diplo;
          resizeTextarea(judgeResponseDiplomatic);
        }
      },
      () => {
        // On success, reset buttons
        judgeSubmitBtn.disabled = false;
        judgeSubmitBtn.querySelector('.btn-text').textContent = '🧭 Décrypter le message';
        judgeSubmitBtn.querySelector('.btn-loader').style.display = 'none';
        
        // Final textareas adjustment
        resizeTextarea(judgeResponsePro);
        resizeTextarea(judgeResponseDirect);
        resizeTextarea(judgeResponseDiplomatic);
      },
      (err) => {
        // On error, reset buttons and show error
        judgeSkeleton.style.display = 'none';
        judgeResults.style.display = 'block';
        judgeAnalysisText.innerHTML = `<span style="color: red;"><strong>Erreur :</strong></span> ${err.message}`;
        
        judgeSubmitBtn.disabled = false;
        judgeSubmitBtn.querySelector('.btn-text').textContent = '🧭 Décrypter le message';
        judgeSubmitBtn.querySelector('.btn-loader').style.display = 'none';
      }
    );
  });

  function parseJudgeResponse(fullText) {
    if (!fullText) return { analysis: '', pro: '', direct: '', diplo: '' };

    const regexPro = /(?:###\s*(?:1\.?\s*)?REPONSE_PRO|<<<\s*REPONSE_PRO\s*>>>|\*\*R[eé]ponse\s*professionnelle\s*:\*\*|###\s*R[eé]ponse\s*professionnelle)/i;
    const regexDirect = /(?:###\s*(?:2\.?\s*)?REPONSE_DIRECTE|<<<\s*REPONSE_DIRECTE\s*>>>|\*\*R[eé]ponse\s*directe\s*:\*\*|###\s*R[eé]ponse\s*directe)/i;
    const regexDiplo = /(?:###\s*(?:3\.?\s*)?REPONSE_DIPLOMATIQUE|<<<\s*REPONSE_DIPLOMATIQUE\s*>>>|\*\*R[eé]ponse\s*diplomatique\s*:\*\*|###\s*R[eé]ponse\s*diplomatique)/i;

    const idxPro = fullText.search(regexPro);
    const idxDirect = fullText.search(regexDirect);
    const idxDiplo = fullText.search(regexDiplo);

    const validIndices = [idxPro, idxDirect, idxDiplo].filter(i => i !== -1);
    let analysis = fullText;
    if (validIndices.length > 0) {
      const minIdx = Math.min(...validIndices);
      analysis = fullText.substring(0, minIdx).trim();
      analysis = analysis.replace(/\n\s*---\s*$/g, '').replace(/###\s*Suggestions?\s*de\s*r[eé]ponses?\s*:?\s*$/i, '').trim();
    }

    let pro = '';
    let direct = '';
    let diplo = '';

    const matchPro = fullText.match(/(?:###\s*(?:1\.?\s*)?REPONSE_PRO|<<<\s*REPONSE_PRO\s*>>>|\*\*R[eé]ponse\s*professionnelle\s*:\*\*|###\s*R[eé]ponse\s*professionnelle)\s*:?\s*([\s\S]*?)(?=(?:###\s*(?:2\.?\s*)?REPONSE_DIRECTE|<<<\s*REPONSE_DIRECTE\s*>>>|\*\*R[eé]ponse\s*directe\s*:\*\*|###\s*R[eé]ponse\s*directe|###\s*(?:3\.?\s*)?REPONSE_DIPLOMATIQUE|<<<\s*REPONSE_DIPLOMATIQUE\s*>>>|\*\*R[eé]ponse\s*diplomatique\s*:\*\*|###\s*R[eé]ponse\s*diplomatique|$))/i);
    if (matchPro) pro = matchPro[1].trim();

    const matchDirect = fullText.match(/(?:###\s*(?:2\.?\s*)?REPONSE_DIRECTE|<<<\s*REPONSE_DIRECTE\s*>>>|\*\*R[eé]ponse\s*directe\s*:\*\*|###\s*R[eé]ponse\s*directe)\s*:?\s*([\s\S]*?)(?=(?:###\s*(?:3\.?\s*)?REPONSE_DIPLOMATIQUE|<<<\s*REPONSE_DIPLOMATIQUE\s*>>>|\*\*R[eé]ponse\s*diplomatique\s*:\*\*|###\s*R[eé]ponse\s*diplomatique|$))/i);
    if (matchDirect) direct = matchDirect[1].trim();

    const matchDiplo = fullText.match(/(?:###\s*(?:3\.?\s*)?REPONSE_DIPLOMATIQUE|<<<\s*REPONSE_DIPLOMATIQUE\s*>>>|\*\*R[eé]ponse\s*diplomatique\s*:\*\*|###\s*R[eé]ponse\s*diplomatique)\s*:?\s*([\s\S]*?)$/i);
    if (matchDiplo) diplo = matchDiplo[1].trim();

    return { analysis, pro, direct, diplo };
  }

  // Setup click handler for copy buttons
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const textarea = document.getElementById(targetId);
      if (!textarea || !textarea.value) return;

      navigator.clipboard.writeText(textarea.value).then(() => {
        const originalIcon = btn.innerHTML;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        window.showToast("Réponse copiée dans le presse-papiers ! ✓");
        setTimeout(() => btn.innerHTML = originalIcon, 1800);
      });
    });
  });
}
