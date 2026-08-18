// Fichier: modules/utils/h5p-library-manager.js

import { H5P_FALLBACK_VERSIONS } from './h5p-constants.js';
import { logger } from './logger.js';

let h5pLibraryVersions = new Map();

/**
 * Charge les versions H5P à partir du CSV.
 * (Code des lignes 857-892)
 */
async function loadLibraryVersions() {
    // Versions de secours (au cas où)
    for (const [name, version] of Object.entries(H5P_FALLBACK_VERSIONS)) {
        h5pLibraryVersions.set(name, version);
    }

    const path = 'H5P-libraries-list/H5P-libraries-list.csv';
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Statut: ${response.status}`);
        
        const csvText = await response.text();
        // On découpe par ligne
        const lines = csvText.split(/\r?\n/);
        let updatedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 1. DÉCOUPAGE PAR POINT-VIRGULE (;)
            const parts = line.split(';');
            
            if (parts.length >= 2) {
                const name = parts[0].trim();           // Ex: H5P.ImagePair
                const versionString = parts[1].trim();  // Ex: 1.4.0
                
                // 2. PARSING INTELLIGENT DE LA VERSION (ex: "1.4.0" -> 1 et 4)
                const versionParts = versionString.split('.').map(Number);
                
                if (name && versionParts.length >= 2 && !isNaN(versionParts[0]) && !isNaN(versionParts[1])) {
                    h5pLibraryVersions.set(name, { 
                        major: versionParts[0], 
                        minor: versionParts[1] 
                    });
                    updatedCount++;
                }
            }
        }
        logger.log(`✅ ${updatedCount} librairies chargées depuis le CSV (Format: Nom;Version).`);
        
    } catch (error) {
        logger.warn(`Erreur lecture CSV : ${error.message}`);
    }
}

function getVersion(name) {
    return h5pLibraryVersions.get(name) || { major: 1, minor: 0 };
}

export function getFullLibraryString(name) {
    const version = getVersion(name);
    return `${name} ${version.major}.${version.minor}`;
}

export function getDependencyObject(name) {
    const version = getVersion(name);
    return { machineName: name, majorVersion: version.major, minorVersion: version.minor };
}

// L'initialisation se fait au chargement du module
const initPromise = loadLibraryVersions();

// On exporte une fonction `ready` pour que d'autres modules
// puissent attendre que les versions soient chargées.
export const libraryManager = {
    ready: () => initPromise,
    getVersion,
    getFullLibraryString,
    getDependencyObject
};