// Fichier: modules/utils/languages.js

/**
 * Liste centralisée des langues disponibles pour l'IA.
 * value : Ce qui est envoyé au prompt IA.
 * label : Ce qui est affiché à l'utilisateur.
 * flag  : Le drapeau pour faire joli.
 */
export const AVAILABLE_LANGUAGES = [
    { value: 'Français', label: 'Français', flag: '🇫🇷' },
    { value: 'English', label: 'Anglais', flag: '🇬🇧' },
    { value: 'Spanish', label: 'Espagnol', flag: '🇪🇸' },
    { value: 'German', label: 'Allemand', flag: '🇩🇪' },
    { value: 'Italian', label: 'Italien', flag: '🇮🇹' },
    { value: 'Dutch', label: 'Néerlandais', flag: '🇳🇱' },
    { value: 'Portuguese', label: 'Portugais', flag: '🇵🇹' },
	{ value: 'Latin', label: 'Latin', flag: '🏛️' },
	{ value: 'Normand', label: 'Normand', flag: '🐄' },	
	//{ value: 'Arabe', label: 'Arabe', flag: '🧞' },	
    // Tu peux en ajouter d'autres ici facilement
];

/**
 * Génère le HTML des <option> pour un menu <select>.
 * @param {string} defaultLang - La valeur de la langue sélectionnée par défaut (ex: 'Français').
 * @returns {string} Le code HTML des options.
 */
export function getLanguageOptionsHTML(defaultLang = 'Français') {
    return AVAILABLE_LANGUAGES.map(lang => {
        const isSelected = lang.value === defaultLang ? 'selected' : '';
        return `<option value="${lang.value}" ${isSelected}>${lang.flag} ${lang.label}</option>`;
    }).join('\n');
}