// Fichier: modules/utils/config-manager.js
import { logger } from './logger.js';

export function exportConfigToJSON(data, filename = 'activite-config.json') {
    try {
        const jsonString = JSON.stringify(data, null, 4); 
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        logger.log(`💾 Configuration exportée avec succès : ${filename}`);
    } catch (error) {
        logger.error(`Erreur lors de l'export JSON : ${error.message}`);
        alert("Une erreur est survenue lors de la sauvegarde de la configuration.");
    }
}

export function importConfigFromJSON(file) {
    return new Promise((resolve, reject) => {
        // ✅ CORRECTION : Vérification tolérante du type MIME ou de l'extension .json
        if (!file || (file.type !== "application/json" && !file.name.toLowerCase().endsWith('.json'))) {
            reject(new Error("Le fichier fourni n'est pas un JSON valide."));
            return;
        }

        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const configData = JSON.parse(event.target.result);
                logger.log(`📂 Configuration importée avec succès depuis : ${file.name}`);
                resolve(configData);
            } catch (error) {
                logger.error(`Erreur de parsing JSON : ${error.message}`);
                reject(new Error("Le fichier JSON est corrompu ou mal formaté."));
            }
        };

        reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier."));
        reader.readAsText(file);
    });
}