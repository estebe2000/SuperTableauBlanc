// Fichier: modules/utils/states/interactive-video-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DE LA VIDÉO INTERACTIVE (Export JSON)
 * Cette fonction extrait absolument tout ce qui définit l'activité.
 */
export function getInteractiveVideoState(videoMetadata, interactions, bookmarks, globalSettings) {
    return {
        type: 'interactive-video',
        
        // Métadonnées techniques et transcription
        videoMetadata: { ...videoMetadata },
        
        // Contenu pédagogique
        interactions: JSON.parse(JSON.stringify(interactions)),
        bookmarks: JSON.parse(JSON.stringify(bookmarks)),
        
        // Configuration du lecteur et de la navigation
        globalSettings: { ...globalSettings },

        // État des sélecteurs globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français'
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DE LA VIDÉO INTERACTIVE (Import JSON)
 * Cette fonction reconstruit l'UI et débloque les boutons de l'application.
 */
export function setInteractiveVideoState(config, uiActions) {
    logger.log("📂 Restauration rigoureuse de l'état Vidéo Interactive...");

    // 1. Restauration des sélecteurs de contexte (Niveau/Langue)
    //if (config.niveau && document.getElementById('global-niveau')) {
    //    document.getElementById('global-niveau').value = config.niveau;
    //}
    //if (config.langue && document.getElementById('global-language')) {
    //    document.getElementById('global-language').value = config.langue;
    //}
	
// 🌟 Restauration du Titre Principal de l'activité
    const mainTitleInput = document.getElementById('vid-main-title');
    if (mainTitleInput && config.videoMetadata?.mainTitle) {
        mainTitleInput.value = config.videoMetadata.mainTitle;
    }

    // 2. Restauration de l'URL (avec décodage pour l'affichage utilisateur)
    const urlInput = document.getElementById('vid-url-input');
    if (urlInput && config.videoMetadata?.url) {
        let displayUrl = config.videoMetadata.url;
        // On retire le proxy pour l'affichage visuel (plus propre)
        if (displayUrl.includes('proxy/stream?url=')) {
            try {
                const match = displayUrl.match(/[?&]url=([^&]+)/);
                if (match) displayUrl = decodeURIComponent(match[1]);
            } catch(e) { logger.warn("Erreur décodage URL"); }
        }
        urlInput.value = displayUrl;
    }

    // 3. Restauration du Transcript et de la durée
    const transcriptArea = document.getElementById('vid-transcript-display');
    if (transcriptArea && config.videoMetadata) {
        // On privilégie le texte brut sauvegardé (conserve les corrections manuelles)
        transcriptArea.value = config.videoMetadata.transcript || "";
        
        const durDisplay = document.getElementById('vid-duration');
        if (durDisplay && config.videoMetadata.duration) {
            durDisplay.textContent = uiActions.formatTs(config.videoMetadata.duration);
        }
    }

    // 4. Pilotage de la visibilité des étapes de l'interface
    // On affiche le transcript, l'éditeur et les paramètres
    const stepsToShow = ['vid-step-transcript', 'vid-step-editor', 'vid-step-settings'];
    stepsToShow.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    });

    // Optionnel : Masquer l'étape de choix IA (Étape 3) car l'activité est déjà générée
    //const stepIA = document.getElementById('vid-step-transcript'); 
    // Si vous voulez masquer spécifiquement la zone du bouton "Générer avec Albert" :
    //const iaButtons = document.getElementById('vid-generate-btn')?.parentElement;
    //if (iaButtons) iaButtons.style.display = 'none';

    // 5. Gestion des détails (Bookmarks)
    if (config.bookmarks && config.bookmarks.length > 0) {
        const details = document.querySelector('#vid-step-settings details');
        if (details) details.open = true;
    }

    // 6. DÉBLOCAGE DES BOUTONS GLOBAUX (Prévisualisation / Génération H5P)
    // C'est ici que l'on fait le lien avec le footer de l'application
    const generateSec = document.getElementById('generate-section');
    const hasContent = config.interactions && config.interactions.length > 0;
    
    if (generateSec && hasContent) {
        generateSec.style.display = 'block';
        generateSec.classList.remove('hidden'); // Sécurité si une classe CSS 'hidden' existe
    }

    // 7. Notification à l'application (Mise à jour du bouton Générer H5P)
    if (uiActions.updateBtn) {
        uiActions.updateBtn();
    }
    
    logger.log("✅ Hydratation de l'UI terminée.");
}