// Fichier: modules/ia/prompts/interactive-map-prompt.js

import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_InteractiveMap(repartitionMap = null) {
    const level = document.getElementById('map-level')?.value || 'Cycle 3';
    const subject = document.getElementById('map-subject')?.value || 'Histoire-Géographie';

    const type = `extraction de repères spatio-temporels pour une carte interactive sur le sujet : "${subject}".`;
    
    const formatExemple = `FORMAT DE RÉPONSE OBLIGATOIRE (JSON PUR):
1. Réponds UNIQUEMENT avec un objet JSON contenant : "intro" et "markers".
2. Structure :
   - "intro": "Texte de présentation (max 250 car.)."
   - "markers": [ tableau de lieux ]
3. Chaque objet dans "markers" doit avoir :
   - "lat": Latitude (ex: 45.8688) -> DOIT ÊTRE UN NOMBRE.
   - "lng": Longitude (ex: 7.1708) -> DOIT ÊTRE UN NOMBRE.
   - "title": "Nom du lieu/événement"
   - "date": "Date ou époque de l'événement"
   - "desc": "Description du lien avec ${subject} (max 200 car.)."
   - "image_query": "Mots-clés pour recherche d'image Wikimedia (ex: 'Passage des Alpes David')."

IMPORTANT : Les coordonnées GPS (lat, lng) doivent être aussi précises que possible selon tes connaissances géographiques.`;

    // Utilise la fonction générique existante dans HAPI
    const prompt = await genererPromptIAHierarchise(
        level, type, formatExemple, 'strict', 'Français', repartitionMap, false
    );

    if (prompt) {
        document.getElementById('ia-prompt-map').value = prompt;
        document.getElementById(`ia-assistant-section-ia-prompt-map`).style.display = 'block';
    }
    return !!prompt;
}