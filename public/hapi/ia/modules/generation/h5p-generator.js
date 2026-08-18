// Fichier: modules/generation/h5p-generator.js
// Rôle : Routeur/Hub centralisant tous les modules générateurs granulaires
// Plus aucune logique métier ici, on ne fait que relayer vers le bon fichier !

// ============================================================================
// 1. IMPORTS DES ACTIVITÉS DEPUIS LEURS FICHIERS DÉDIÉS
// ============================================================================
// (Assure-toi de bien créer ces fichiers dans ton dossier 'activities' avec le temps)

import { genererH5PQuiz } from './activities/quiz-generator.js';
import { genererH5PDictation } from './activities/dictation-generator.js';
import { genererH5PWordSearch } from './activities/wordsearch-generator.js';
import { genererH5PMarkTheWords } from './activities/markthewords-generator.js';
import { genererH5PDragText } from './activities/dragtext-generator.js';
import { genererH5PAdvancedBlanks } from './activities/advancedblanks-generator.js';
import { genererH5PCrossword } from './activities/crosswords-generator.js';
import { genererH5PSortParagraphs } from './activities/sortparagraphs-generator.js';
import { genererH5PSummary } from './activities/summary-generator.js';
import { genererH5PAccordion } from './activities/accordion-generator.js';
import { genererH5PCards } from './activities/cards-generator.js';
import { genererH5PImagePairing } from './activities/image-pairing-generator.js';
import { genererH5PTimeline } from './activities/timeline-generator.js';

// Les fichiers complexes qu'on a déjà isolés ensemble
import { genererH5PDragQuestion } from './activities/dragndrop-generator.js';
import { genererH5PStandaloneThreeDModel, genererZIPViewer, genererZIPMoleculesLot } from './activities/molecules3D-generator.js';
import { genererZIPInteractiveMap } from './activities/interactive-map-generator.js';


// ============================================================================
// 2. EXPORTS POUR APP.JS (Rétrocompatibilité garantie à 100%)
// ============================================================================
export {
    genererH5PQuiz,
    genererH5PDictation,
    genererH5PWordSearch,
    genererH5PMarkTheWords,
    genererH5PDragText,
    genererH5PAdvancedBlanks,
    genererH5PCrossword,
    genererH5PSortParagraphs,
    genererH5PSummary,
    genererH5PAccordion,
    genererH5PCards,
    genererH5PImagePairing,
    genererH5PTimeline,
    
    // 💡 Astuce : On renomme l'export à la volée pour que app.js 
    // puisse toujours appeler "genererH5PCategorisation" sans rien casser !
    genererH5PDragQuestion as genererH5PCategorisation,

    // Wrappers 3D
    genererH5PStandaloneThreeDModel as genererH5PModele,
    genererZIPViewer as genererZIPModele,
    genererZIPMoleculesLot,

    // Carte interactive
    genererZIPInteractiveMap
};