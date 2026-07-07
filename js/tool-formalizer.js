import { makeStreamingRequest } from './api.js';

export function initFormalizer() {
  const formalizerInput = document.getElementById('formalizerInput');
  const toneBtns = document.querySelectorAll('.tone-btn:not(.doc-btn)');
  const formalizerSubmitBtn = document.getElementById('formalizerSubmitBtn');
  const formalizerCopyBtn = document.getElementById('formalizerCopyBtn');
  const formalizerPlaceholder = document.getElementById('formalizerPlaceholder');
  const formalizerSkeleton = document.getElementById('formalizerSkeleton');
  const formalizerOutput = document.getElementById('formalizerOutput');

  if (!formalizerInput || !formalizerSubmitBtn) {
    console.warn("Formalizer DOM elements not found, skipping.");
    return;
  }

  let selectedTones = new Set(['professionnel']);

  toneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tone = btn.getAttribute('data-tone');
      if (selectedTones.has(tone)) {
        selectedTones.delete(tone);
        btn.classList.remove('active');
      } else {
        selectedTones.add(tone);
        btn.classList.add('active');
      }
    });
  });

  const toneDescriptions = {
    professionnel: "professionnel, formel, poli, diplomatique",
    technique: "très technique, précis, rigoureux et adapté à des experts du domaine",
    accessible: "très accessible, chaleureux et facile à comprendre pour un large public",
    poli: "extrêmement poli, courtois, respectueux et diplomate",
    "moins-sarcastique": "neutre, sérieux, factuel, débarrassé de tout sarcasme ou ironie",
    colere: "très en colère, mécontent, véhément et direct",
    "facile-lire": "très facile à lire, simple, limpide (accessible aux personnes ayant des difficultés de lecture)",
    formel: "très formel, académique, soigné et distingué",
    informel: "informel, décontracté, familier et amical",
    sociable: "sociable, détaillé, chaleureux et riche en explications",
    concis: "très concis, direct, allant droit au but en un minimum de mots",
    "moins-emotionnel": "neutre, purement rationnel, objectif et dénué d'émotions",
    passionne: "passionné, enthousiaste, vibrant et dynamique",
    sarcastique: "sarcastique, ironique, piquant et humoristique",
    grammaire: "grammaticalement correct",
    puces: "sous forme de liste à puces",
    "un-mot": "d'un seul mot (mode thésaurus)"
  };

  formalizerSubmitBtn.addEventListener('click', () => {
    const text = formalizerInput.value.trim();
    if (!text) { alert("Veuillez saisir un texte."); return; }

    formalizerSubmitBtn.disabled = true; formalizerSubmitBtn.querySelector('.btn-text').textContent = 'Reformulation...';
    formalizerSubmitBtn.querySelector('.btn-loader').style.display = 'block';
    formalizerPlaceholder.style.display = 'none'; formalizerSkeleton.style.display = 'flex';
    formalizerOutput.style.display = 'none'; formalizerOutput.textContent = ''; formalizerCopyBtn.disabled = true;

    let instruction = "";
    if (selectedTones.size === 0) {
      instruction = `Reformule le texte suivant de manière claire et bien structurée. Conserve exactement le sens d'origine.`;
    } else if (selectedTones.size === 1) {
      const tone = Array.from(selectedTones)[0];
      const toneText = toneDescriptions[tone] || toneDescriptions.professionnel;
      if (tone === 'puces') {
        instruction = `Reformule le texte suivant sous forme de liste à puces claire et ordonnée. Conserve exactement le sens d'origine.`;
      } else if (tone === 'un-mot') {
        instruction = `Trouve un unique mot synonyme ou une expression courte équivalente pour le texte suivant (mode thésaurus).`;
      } else if (tone === 'grammaire') {
        instruction = `Corrige uniquement les fautes d'orthographe, de grammaire et de syntaxe du texte suivant. Conserve exactement le ton et le sens d'origine.`;
      } else {
        instruction = `Reformule le texte suivant en adoptant un ton ${toneText}. Conserve exactement le sens d'origine.`;
      }
    } else {
      const criteria = [];
      selectedTones.forEach(tone => {
        if (tone === 'puces') {
          criteria.push("reformuler sous forme de liste à puces claire et ordonnée");
        } else if (tone === 'un-mot') {
          criteria.push("trouver un unique mot synonyme ou une expression courte équivalente (mode thésaurus)");
        } else if (tone === 'grammaire') {
          criteria.push("corriger uniquement les fautes d'orthographe, de grammaire et de syntaxe");
        } else {
          const tDesc = toneDescriptions[tone];
          criteria.push(`adopter un ton ${tDesc}`);
        }
      });
      instruction = `Reformule le texte suivant en respectant les critères suivants :\n${criteria.map(c => `- ${c}`).join('\n')}\nConserve exactement le sens d'origine.`;
    }

    const prompt = `${instruction}\nTexte : "${text}"\nNe renvoie que la version reformulée finale, sans aucun commentaire.`;

    makeStreamingRequest(prompt, { tool: 'formalizer' }, (chunk, full) => {
      formalizerSkeleton.style.display = 'none'; formalizerOutput.style.display = 'block';
      formalizerOutput.textContent = full;
      formalizerOutput.parentElement.scrollTop = formalizerOutput.parentElement.scrollHeight;
    }, () => {
      formalizerCopyBtn.disabled = false; formalizerSubmitBtn.disabled = false;
      formalizerSubmitBtn.querySelector('.btn-text').textContent = 'Reformuler';
      formalizerSubmitBtn.querySelector('.btn-loader').style.display = 'none';
    }, (err) => {
      formalizerSkeleton.style.display = 'none'; formalizerOutput.style.display = 'block';
      formalizerOutput.innerHTML = `<span style="color: red;">Erreur :</span> ${err.message}`;
      formalizerSubmitBtn.disabled = false; formalizerSubmitBtn.querySelector('.btn-text').textContent = 'Reformuler';
      formalizerSubmitBtn.querySelector('.btn-loader').style.display = 'none';
    });
  });

  formalizerCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(formalizerOutput.textContent).then(() => {
      const original = formalizerCopyBtn.innerHTML;
      formalizerCopyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => formalizerCopyBtn.innerHTML = original, 1500);
    });
  });
}
