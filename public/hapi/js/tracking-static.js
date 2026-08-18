// ==========================================
// 📈 SUIVI MATOMO — Pages Statiques (Accueil, CGU, etc.)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (event) => {
        if (!window._paq) return;

        const link = event.target.closest('a');
        if (!link) return; // On ne traque que les clics sur des liens

        // 1️⃣ Clics sur les grosses cartes de la page d'accueil (index.html à la racine)
        const card = link.closest('.platform-card');
        if (card) {
            let platformName = 'Autre';
            if (card.classList.contains('h5p')) platformName = 'Avec IA (H5P)';
            else if (card.classList.contains('scorm')) platformName = 'Sans IA (SCORM)';
            else if (card.classList.contains('outils')) platformName = 'Outils';
            
            window._paq.push(['trackEvent', 'HAPI - Navigation', 'Clic Accueil', platformName]);
            return;
        }

        // 2️⃣ Clics sur le menu d'aide (en haut à droite)
        if (link.closest('.hapi-aides')) {
            const linkName = link.textContent.trim() || link.title;
            window._paq.push(['trackEvent', 'HAPI - Navigation', 'Clic Aide Header', linkName]);
            return;
        }

        // 3️⃣ Clics dans le footer (Mentions, CGU, Forge, etc.)
        if (link.closest('.footer-links')) {
            const linkName = link.textContent.trim() || link.title;
            window._paq.push(['trackEvent', 'HAPI - Navigation', 'Clic Footer', linkName]);
            return;
        }
    });
});