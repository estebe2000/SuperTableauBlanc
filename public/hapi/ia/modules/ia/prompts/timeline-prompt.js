// Fichier: modules/ia/prompts/timeline-prompt.js

import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_Timeline(repartitionMap = null) {
    const level = document.getElementById('timeline-level')?.value || 'Cycle 4';
    const subject = document.getElementById('timeline-subject')?.value || 'Histoire';
    const langue = document.getElementById('timelineLanguage')?.value || 'Français';

    const type = `chronologie structurée et thématique (Timeline H5P) sur le sujet : "${subject}".`;
    
    const formatExemple = `FORMAT DE RÉPONSE OBLIGATOIRE (JSON PUR):
1. Réponds UNIQUEMENT avec un objet JSON contenant deux clés : "intro" et "events".
2. Structure :
   - "intro": "Un résumé synthétique et accrocheur de la thématique globale (max 250 caractères) qui servira de texte de présentation."
   - "events": [ tableau d'objets événements ]
3. Chaque objet dans "events" doit avoir :
   - "startDate": "YYYY-MM-DD" (Ex: "1789-07-14") ou "YYYY".
   - "endDate": "YYYY" ou "YYYY-MM-DD" (Optionnel)
   - "headline": "Titre marquant de l'événement"
   - "text": "Description pédagogique courte (max 300 caractères) soulignant le lien avec ${subject}."
   - "image_prompt": "Mots-clés visuels courts pour Wikimedia Commons (Max 5 mots)."

IMPORTANT : Format de date strict YYYY-MM-DD. Pas de mois seul (YYYY-MM).

EXEMPLE DE STRUCTURE ATTENDUE:
{
  "intro": "La Révolution française marque un tournant majeur...",
  "events": [
    {
      "startDate": "1789-07-14",
      "headline": "Prise de la Bastille",
      "text": "Le peuple parisien s'empare de la prison...",
      "image_prompt": "Bastille Day painting"
    }
  ]
}`;

    const prompt = await genererPromptIAHierarchise(
        level, 
        type, 
        formatExemple, 
        'strict', 
        langue, 
        repartitionMap, 
        true // ✅ MODIFICATION ICI : 'true' pour forcer le respect absolu des compteurs de dates !
    );

    if (prompt) {
        document.getElementById('ia-prompt-timeline').value = prompt;
        document.getElementById(`ia-assistant-section-ia-prompt-timeline`).style.display = 'block';
    }
    return !!prompt;
}