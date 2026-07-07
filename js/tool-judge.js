import { makeStreamingRequest, formatMarkdown } from './api.js';

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

    const prompt = `Tu es "Judge AI", un expert en communication interpersonnelle et en décryptage des intentions.
Analyse le message suivant envoyé par un interlocuteur :
"${text}"

Effectue une analyse rigoureuse et objective selon les axes suivants :
1. Ton perçu (ex: passif-agressif, poli, agacé, neutre, bienveillant, etc.)
2. Intention réelle et sous-texte (ce que l'auteur veut vraiment dire ou obtenir)
3. Émotion sous-jacente détectée

Ensuite, propose trois suggestions de réponses distinctes adaptées à différentes stratégies de communication.

Formatte ta réponse exactement ainsi, en respectant cette structure exacte et ces séparateurs textuels (les trois traits d'union sont obligatoires) :

[Ton analyse détaillée ici sous forme de paragraphes courts ou liste à puces. Sois direct et constructif.]

---
### REPONSE_PRO
[Réponse professionnelle et courtoise, polie et axée sur la résolution. Rédige uniquement le corps de la réponse sans introduction ni conclusion.]

### REPONSE_DIRECTE
[Réponse neutre, concise et directe. Rédige uniquement le corps de la réponse sans introduction ni conclusion.]

### REPONSE_DIPLOMATIQUE
[Réponse diplomatique, calme, visant à désamorcer les tensions s'il y en a. Rédige uniquement le corps de la réponse sans introduction ni conclusion.]`;

    makeStreamingRequest(
      prompt,
      { tool: 'judge' },
      (chunk, full) => {
        // Hide skeleton and show results
        judgeSkeleton.style.display = 'none';
        judgeResults.style.display = 'block';

        // Split analysis and responses
        const parts = full.split('---');
        const analysisPart = parts[0] ? parts[0].trim() : '';
        const responsesPart = parts[1] ? parts[1].trim() : '';

        // 1. Render Markdown analysis
        formatMarkdown(judgeAnalysisText, analysisPart);

        // 2. Parse responses if available
        if (responsesPart) {
          const proMatch = responsesPart.match(/### REPONSE_PRO\s*([\s\S]*?)(?=\s*###|$)/i);
          const directMatch = responsesPart.match(/### REPONSE_DIRECTE\s*([\s\S]*?)(?=\s*###|$)/i);
          const diploMatch = responsesPart.match(/### REPONSE_DIPLOMATIQUE\s*([\s\S]*?)(?=\s*###|$)/i);

          if (proMatch) {
            judgeResponsePro.value = proMatch[1].trim();
            resizeTextarea(judgeResponsePro);
          }
          if (directMatch) {
            judgeResponseDirect.value = directMatch[1].trim();
            resizeTextarea(judgeResponseDirect);
          }
          if (diploMatch) {
            judgeResponseDiplomatic.value = diploMatch[1].trim();
            resizeTextarea(judgeResponseDiplomatic);
          }
        }
      },
      () => {
        // On success, reset buttons
        judgeSubmitBtn.disabled = false;
        judgeSubmitBtn.querySelector('.btn-text').textContent = '⚖️ Décrypter le message';
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
        judgeSubmitBtn.querySelector('.btn-text').textContent = '⚖️ Décrypter le message';
        judgeSubmitBtn.querySelector('.btn-loader').style.display = 'none';
      }
    );
  });

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
