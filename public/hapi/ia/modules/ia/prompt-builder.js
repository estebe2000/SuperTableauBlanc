// Fichier: modules/ia/prompt-builder.js
// FAÇADE : Regroupe et ré-exporte les prompts unitaires

export { genererPromptIAHierarchise } from './prompt-engine.js';

// Imports des modules unitaires avec la nouvelle nomenclature
export { preparerAssistantIA_Quiz } from './prompts/qcm-prompt.js';
export { preparerAssistantIA_TrueFalse } from './prompts/truefalse-prompt.js';
export { preparerAssistantIA_Dictation } from './prompts/dictation-prompt.js';
export { preparerAssistantIA_SortParagraphs } from './prompts/sortparagraphs-prompt.js';
export { preparerAssistantIA_Summary } from './prompts/summary-prompt.js';
export { preparerAssistantIA_Accordion } from './prompts/accordion-prompt.js';
export { preparerAssistantIA_AdvancedBlanks } from './prompts/advancedblanks-prompt.js';
export { preparerAssistantIA_Categorisation } from './prompts/dragndrop-prompt.js';
export { preparerAssistantIA_Crossword } from './prompts/crosswords-prompt.js';
export { preparerAssistantIA_QuizMath } from './prompts/quiz-math-prompt.js';
export { preparerAssistantIA_TrueFalseMath } from './prompts/truefalse-math-prompt.js';
export { preparerAssistantIA_DragText } from './prompts/dragtext-prompt.js';
export { preparerAssistantIA_WordSearch } from './prompts/wordsearch-prompt.js';
export { preparerAssistantIA_MarkWords } from './prompts/markthewords-prompt.js';
export { preparerAssistantIA_Cards } from './prompts/cards-prompt.js';
export { preparerPrompt_IdesAppariement, preparerAssistantIA_ImagePairing } from './prompts/image-pairing-prompt.js';
export { preparerAssistantIA_Timeline } from './prompts/timeline-prompt.js';
export { preparerAssistantIA_InteractiveMap } from './prompts/interactive-map-prompt.js';
export { preparerAssistantIA_Molecules3D } from './prompts/molecules3D-prompt.js';
export { genererPrompt_H5PVideo } from './prompts/h5p-video-prompt.js';


