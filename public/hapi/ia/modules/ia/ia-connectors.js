// Fichier: modules/ia/ia-connectors.js

import { logger } from '../utils/logger.js';
import { announce } from '../utils/a11y-labeler.js';

// ✅ CORRECTION 1 : URL passée en /webhook/ (l'erreur CORS 404 disparaît)
const ALBERT_WORKER_URL = (typeof window !== 'undefined' ? window.location.origin : '') + "/proxy-n8n/webhook/hapi_albert";

/**
 * Appelle l'API Albert via le Webhook n8n, remplit la zone de réponse 
 * et déclenche automatiquement le parsing.
 */
export async function callAlbertAPI(promptId, responseId, parseBtnId, buttonElement) {
    const promptElement = document.getElementById(promptId);
    const responseElement = document.getElementById(responseId);
    const parseBtn = document.getElementById(parseBtnId);
    
    if (!promptElement || !promptElement.value) {
        alert("Veuillez d'abord préparer le prompt !");
        return;
    }

    // -- 1. Mise à jour de l'UI (État de chargement) --
    const originalBtnText = buttonElement ? buttonElement.innerHTML : 'Générer';
    if (buttonElement) {
        buttonElement.innerHTML = '⏳ Génération en cours...';
        buttonElement.disabled = true;
    }
    announce('Génération du contenu par l’IA en cours, veuillez patienter…');

    const isParentLLM = window.parent && typeof window.parent.makeNonStreamingRequest === 'function';
    try {
        let albertResponse;
        if (isParentLLM) {
            logger.log("🤖 Utilisation du connecteur LLM de l'application principale");
            albertResponse = await window.parent.makeNonStreamingRequest(promptElement.value, {
                tool: 'professor'
            });
        } else {
            // -- 2. Appel au Webhook n8n --
            const response = await fetch(ALBERT_WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // ✅ CORRECTION 2 : Alignement sur le format "messages" attendu par votre workflow n8n
                body: JSON.stringify({ 
                    messages: [
                        {
                            role: "user",
                            content: promptElement.value
                        }
                    ],
                    module: "interface-web" // Ajouté car prévu dans votre workflow n8n
                })
            });

            // 🟢 GESTION DES ERREURS BLINDÉE
            if (!response.ok) {
                let errorMessage = `Erreur HTTP ${response.status} renvoyée par n8n`;
                try {
                    const errData = await response.json();
                    errorMessage = errData.error || errData.message || errorMessage;
                } catch (e) {
                    const errText = await response.text();
                    errorMessage = errText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // ✅ CORRECTION 3 : Extraction de la réponse selon le format OpenAI renvoyé par n8n
            albertResponse = data.choices?.[0]?.message?.content;
        }

        // -- 3. Remplissage automatique du champ de réponse --
        if (albertResponse && responseElement) {
            responseElement.value = albertResponse;
            logger.log("✅ Réponse d'Albert insérée avec succès.");
            announce('Génération terminée. Le contenu généré est prêt et affiché ci-dessous.');

            // -- 4. Déclenchement automatique du bouton "Parser" --
            if (parseBtn) {
                logger.log("🚀 Déclenchement automatique du parsing...");
                parseBtn.click(); // Simule le clic de l'utilisateur !
            } else {
                logger.warn(`Bouton de parsing non trouvé: #${parseBtnId}`);
            }
        } else {
            throw new Error("La réponse ne contient pas de texte valide.");
        }

    } catch (error) {
        logger.error(`Erreur LLM API: ${error.message}`);
        announce(`Échec de la génération : ${error.message}`, true);
        if (isParentLLM) {
            alert(`❌ Une erreur est survenue lors de l'appel au LLM principal :\n${error.message}`);
        } else {
            alert(`❌ Une erreur est survenue lors de l'appel à n8n :\n${error.message}\n\n👉 Vérifiez que le workflow est bien sur "Active" dans n8n !`);
        }
    } finally {
        // -- 5. Restauration du bouton --
        if (buttonElement) {
            buttonElement.innerHTML = originalBtnText;
            buttonElement.disabled = false;
        }
    }
}