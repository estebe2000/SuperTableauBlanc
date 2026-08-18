// Fichier: modules/utils/logger.js

/**
 * Référence mise en cache à la zone de log pour éviter les querySelector répétés.
 */
let logAreaElement = null;

/**
 * Initialise le module logger en stockant l'élément DOM.
 * Doit être appelé une fois que le DOM est chargé.
 */
function init() {
    logAreaElement = document.getElementById('log-area');
    // On retire le console.warn pour ne plus polluer la console 
    // si le bloc HTML est volontairement absent de l'interface.
}

/**
 * Affiche un message dans la zone de log et la console.
 * @param {string} msg Le message à afficher.
 */
function log(msg) {
    const time = new Date().toLocaleTimeString();
    const message = `[${time}] ${msg}`;

    if (logAreaElement) {
        logAreaElement.innerHTML += `<div>${message}</div>`;
        logAreaElement.scrollTop = logAreaElement.scrollHeight;
    } else {
        // Fallback si l'init a échoué ou si appelé trop tôt
        console.log(message);
    }
}

/**
 * Affiche un message d'avertissement.
 * @param {string} msg Le message d'avertissement.
 */
function warn(msg) {
    log(`⚠️ ${msg}`);
    console.warn(msg);
}

/**
 * Affiche un message d'erreur.
 * @param {string} msg Le message d'erreur.
 */
function error(msg) {
    log(`❌ ${msg}`);
    console.error(msg);
}

// On exporte un objet public qui contient nos fonctions
export const logger = {
    init,
    log,
    warn,
    error
};