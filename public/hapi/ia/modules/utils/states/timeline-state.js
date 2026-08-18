// Fichier: modules/utils/states/timeline-state.js
import { logger } from '../logger.js';

export function getTimelineState() {
    const dates = [];
    document.querySelectorAll('#timeline-cards-list .timeline-card').forEach(card => {
        dates.push({
            start: card.querySelector('.inp-date-start')?.value || '',
            end: card.querySelector('.inp-date-end')?.value || '',
            headline: card.querySelector('.inp-title')?.value || '',
            tag: card.querySelector('.inp-tag')?.value || '',
            text: card.querySelector('.inp-text')?.value || '',
            media: {
                search: card.querySelector('.wiki-search-input')?.value || '',
                src: card.querySelector('.final-img-url')?.value || '', 
                thumb: card.querySelector('.selected-img-preview')?.src || '', 
                credit: card.querySelector('.final-img-credit')?.value || '',
                caption: card.querySelector('.inp-caption')?.value || '',
                detailsVisible: card.querySelector('.media-details')?.style.display === 'block'
            }
        });
    });

    const eras = [];
    document.querySelectorAll('#timeline-eras-list .timeline-era-card').forEach(card => {
        eras.push({
            start: card.querySelector('.era-date-start')?.value || '',
            end: card.querySelector('.era-date-end')?.value || '',
            headline: card.querySelector('.era-title')?.value || '',
            tag: card.querySelector('.era-tag')?.value || '',
            text: card.querySelector('.era-text')?.value || ''
        });
    });

    return {
        type: 'timeline',
        titre: document.getElementById('timeline-subject')?.value || '',
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-timeline')?.checked ?? true,
        introText: document.getElementById('timeline-intro-text')?.value || '',
        introMedia: {
            src: document.getElementById('intro-media-url')?.value || '',
            credit: document.getElementById('intro-media-credit')?.value || '',
            caption: document.getElementById('intro-media-caption')?.value || ''
        },
        background: {
            url: document.getElementById('bg-final-url')?.value || '',
            credit: document.getElementById('bg-final-credit')?.value || '',
            caption: document.getElementById('bg-final-caption')?.value || '',
            opacity: document.getElementById('timeline-bg-opacity')?.value || '20'
        },
        iaPrompt: document.getElementById('ia-prompt-timeline')?.value || '',
        iaResponse: document.getElementById('ia-response-timeline')?.value || '',
        dates: dates,
        eras: eras
    };
}

export function setTimelineState(config, uiActions) {
    if (config.type !== 'timeline') return;

    logger.log('🔄 Restauration de l\'état Timeline...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Paramètres généraux
    setVal('timeline-subject', config.titre);
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-timeline', config.translateUI ?? true);

    // 2. Intro et Background
    setVal('timeline-intro-text', config.introText);
    if (config.introMedia) {
        setVal('intro-media-url', config.introMedia.src);
        setVal('intro-media-credit', config.introMedia.credit);
        setVal('intro-media-caption', config.introMedia.caption);
    }
    if (config.background) {
        setVal('bg-final-url', config.background.url);
        setVal('bg-final-credit', config.background.credit);
        setVal('bg-final-caption', config.background.caption);
        setVal('timeline-bg-opacity', config.background.opacity);
        const bgImg = document.getElementById('bg-selected-img');
        if (bgImg && config.background.url) {
            bgImg.src = config.background.url;
            document.getElementById('bg-preview-zone').style.display = 'flex';
        }
    }

    // 3. IA : Restauration des valeurs
    setVal('ia-prompt-timeline', config.iaPrompt);
    setVal('ia-response-timeline', config.iaResponse);

    // 4. Restauration des événements
    uiActions.clearPreview();
    const hasCards = (config.dates && config.dates.length > 0) || (config.eras && config.eras.length > 0);

    if (config.dates && config.dates.length > 0) {
        config.dates.forEach(d => {
            uiActions.addDateCard({
                startDate: d.start,
                endDate: d.end,
                headline: d.headline,
                tag: d.tag,
                text: d.text,
                asset: {
                    media: d.media?.src,
                    caption: d.media?.caption,
                    credit: d.media?.credit,
                    thumbnail: d.media?.thumb
                }
            });

            const card = document.querySelector('#timeline-cards-list').lastElementChild;
            if (card && d.media) {
                if (d.media.thumb) {
                    const img = card.querySelector('.selected-img-preview');
                    if (img) { img.src = d.media.thumb; img.style.display = 'block'; }
                }
                if (d.media.detailsVisible) {
                    const details = card.querySelector('.media-details');
                    if (details) details.style.display = 'block';
                }
                const wikiInput = card.querySelector('.wiki-search-input');
                if (wikiInput) wikiInput.value = d.media.search || '';
                const finalUrlInput = card.querySelector('.final-img-url');
                if (finalUrlInput) finalUrlInput.value = d.media.src || '';
            }
        });
    }

    if (config.eras && config.eras.length > 0) {
        config.eras.forEach(e => {
            uiActions.addEraCard(); 
            const eraCard = document.querySelector('#timeline-eras-list').lastElementChild;
            if (eraCard) {
                eraCard.querySelector('.era-date-start').value = e.start;
                eraCard.querySelector('.era-date-end').value = e.end;
                eraCard.querySelector('.era-title').value = e.headline;
                eraCard.querySelector('.era-tag').value = e.tag;
                eraCard.querySelector('.era-text').value = e.text;
            }
        });
    }

    // 5. LOGIQUE D'AFFICHAGE INTELLIGENTE
    const iaContainer = document.getElementById('ia-container-timeline');
    const responseArea = document.getElementById('ia-response-timeline');
    const parseBtn = document.getElementById('btn-parse-ia-response-timeline');
    const albertAction = document.getElementById('albert-action-timeline');

    // On montre le chantier IA si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // ✅ SI LES CARTES SONT LÀ : On cache la zone de texte JSON "parasite"
        if (hasCards) {
            if (responseArea && responseArea.parentElement) responseArea.parentElement.style.display = 'none';
            if (parseBtn) parseBtn.style.display = 'none';
        } 
        // ⚠️ SI PAS DE CARTES : On montre la zone de texte pour permettre la validation
        else if (config.iaResponse) {
            if (responseArea && responseArea.parentElement) {
                responseArea.parentElement.style.display = 'block';
                responseArea.style.minHeight = '300px';
            }
            if (parseBtn) parseBtn.style.display = 'inline-block';
        }
    }

    if (hasCards) {
        document.getElementById('editor-timeline').style.display = 'block';
        document.getElementById('era-section-timeline').style.display = 'block';
        document.getElementById('timeline-options-section').style.display = 'block';
        document.getElementById('generate-section').style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}