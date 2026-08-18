import JSZip from '../../../vendor/jszip/jszip.esm.js';
import { logger } from '../utils/logger.js';
import { getDependencyObject, getFullLibraryString } from '../utils/h5p-library-manager.js';
import { generateUUID } from '../utils/helpers.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';

// Fonction partagée pour la langue (extraite de ton code)
export const getH5PLangCode = () => {
    const transUI = document.getElementById('vid-translate-ui')?.checked ?? true;
    const currentLang = transUI ? (document.getElementById('global-language')?.value || 'Français') : 'English';
    const h5pLangMap = {
        'Français': 'fr', 'English': 'en', 'Spanish': 'es', 
        'German': 'de', 'Italian': 'it', 'Dutch': 'nl',
        'Portuguese': 'pt', 'Normand': 'fr', 'Latin': 'la'
    };
    return h5pLangMap[currentLang] || 'fr';
};

// Autre fonction partagée
export function buildBlanksText(rawText, blanks) {
    let i = 0;
    return rawText.replace(/_{3,}/g, () => {
        const mot = blanks[i] ? blanks[i].correctAnswerText : '___';
        i++;
        return `*${mot}*`;
    });
}

// On ré-exporte les outils tiers pour que les activités n'aient qu'un seul fichier à importer
export { JSZip, logger, getDependencyObject, getFullLibraryString, generateUUID, getH5PLocalization };