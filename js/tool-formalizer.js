import { makeStreamingRequest } from './api.js';
import { appConfig } from './config.js';

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
    "facile-lire": "très facile à lire, simple, limpide (accessible aux personnes ayant des difficultés de lecture / FALC)",
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

    let toneDescText = "";
    if (selectedTones.size === 0) {
      toneDescText = "clair, bien structuré et fidèle";
    } else {
      const criteria = [];
      selectedTones.forEach(tone => {
        criteria.push(toneDescriptions[tone] || tone);
      });
      toneDescText = criteria.join(', ');
    }

    let promptTemplate = appConfig.prompts?.formalizer || `Tu es un assistant expert en expression écrite. Reformule le texte selon les critères : {tones}.\nTexte : "{text}"\nRends uniquement la version reformulée finale.`;
    let prompt = promptTemplate
      .replace('{tones}', toneDescText)
      .replace('{text}', text);

    if (!prompt.includes(text)) {
      prompt += `\n\nTexte à reformuler : "${text}"`;
    }

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
