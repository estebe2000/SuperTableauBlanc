// Fichier: modules/ui/workflow-stepper.js
// VRAI WIZARD (un écran à la fois) — piloté par body[data-wizard-step] + CSS,
// donc entièrement RÉVERSIBLE (retirer l'attribut = tout réapparaît).
// Écrans réels : Corpus (#import-section) · Activités (#activity-selector) ·
// Configuration+Finalisation (#generator-content + #generate-section, la
// finalisation étant un onglet injecté dans le workspace).
// Le module OBSERVE les signaux existants (validation corpus, hapiGlobalStateChange,
// bouton finalisation) ; il ne modifie aucune logique métier.

const STEPS = [
    { id: 1, label: 'Corpus',        view: 'corpus' },
    { id: 2, label: 'Activités',     view: 'activites' },
    { id: 3, label: 'Configuration', view: 'config' },
    { id: 4, label: 'Finalisation',  view: 'config' }, // même écran (onglet)
];

let reached = 1;     // étape la plus avancée déverrouillée
let viewStep = 1;    // étape actuellement affichée (1-4)
let detail3 = '';
let lastReady = 0;   // nb d'activités prêtes (pour activer « Suivant : finaliser »)
let stepperEl = null;
let navEl = null;

/* ───────── Styles ───────── */
function injectStyles() {
    if (document.getElementById('hapi-stepper-styles')) return;
    const s = document.createElement('style');
    s.id = 'hapi-stepper-styles';
    s.textContent = `
        /* Bandeau d'étapes */
        .hapi-stepper { position: sticky; top: 0; z-index: 50; background: var(--surface);
            backdrop-filter: blur(6px); border-bottom: 1px solid var(--border); margin: 0; padding: 12px 4px; }
        /* On supprime la marge haute de la 1re section pour réduire l'espace bandeau → titre
           (le padding de la carte, 24px, suffit). */
        .hapi-stepper + #import-section, .hapi-stepper + .section { margin-top: 0; }
        .hapi-stepper ol { list-style: none; display: flex; align-items: flex-start; margin: 0; padding: 0; overflow-x: auto; }
        .hapi-stepper li { display: flex; align-items: center; flex: 1 1 0; min-width: 0; }
        .hapi-stepper li:not(:last-child)::after { content: ''; flex: 1 1 20px; height: 2px; background: var(--border); margin: 0 8px; border-radius: 2px; }
        .hapi-stepper li.is-done::after { background: var(--hapi-green-dark); }
        .step-btn { display: flex; align-items: center; gap: 9px; background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 8px; font-family: inherit; text-align: left; }
        /* Pas d'opacity (elle écrasait le contraste du texte des étapes à venir
           sous 4,5:1). L'état « non franchi » reste signalé par le gris (--text-muted)
           + le curseur not-allowed. */
        .step-btn[disabled] { cursor: not-allowed; }
        .step-num { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; border: 2px solid var(--border); color: var(--text-muted); background: var(--surface); transition: all 0.2s; }
        .step-text { display: flex; flex-direction: column; line-height: 1.15; }
        .step-label { font-weight: 600; color: var(--text-muted); font-size: 0.95rem; white-space: nowrap; }
        .step-detail { font-size: 0.72rem; color: var(--text-muted); font-weight: 500; }
        .hapi-stepper li.is-done .step-num { background: var(--hapi-green-dark); border-color: var(--hapi-green-dark); color: #fff; }
        .hapi-stepper li.is-done .step-label { color: var(--hapi-accent-text); }
        .hapi-stepper li.is-current .step-num { border-color: var(--hapi-green-dark); color: var(--hapi-accent-text); box-shadow: 0 0 0 4px rgba(var(--hapi-green-rgb),0.15); }
        .hapi-stepper li.is-current .step-label { color: var(--hapi-accent-text); }
        /* Étapes À VENIR en sombre : --border/--text-muted trop discrets → on remonte
           le contraste (numéro + bordure + label + connecteur). Les états is-done /
           is-current gardent le vert (sélecteurs plus spécifiques → prioritaires). */
        [data-mode="dark"] .step-num { border-color: #9aa0a8; border-width: 2px; color: #fff; background: #353b46; } /* solides : les checkers compositent mal les rgba empilés */
        /* Étape COURANTE en sombre : le numéro accent (#A78BDB & co) tombe à ~3,9
           sur #353b46 → numéro blanc ; la bordure accent + l'anneau marquent l'état. */
        [data-mode="dark"] .hapi-stepper li.is-current .step-num { color: #fff; }
        [data-mode="dark"] .step-label { color: #fff; }
        [data-mode="dark"] .step-detail { color: var(--text); }
        [data-mode="dark"] .hapi-stepper li:not(:last-child)::after { background: #6e747d; }
        .step-btn:focus-visible { outline: 3px solid var(--hapi-green-dark) !important; outline-offset: 2px; }
        /* Mobile : on empile le numéro AU-DESSUS du libellé pour éviter que les
           libellés (« Configuration »…) chevauchent la pastille suivante quand les
           4 étapes ne tiennent plus en ligne. Le connecteur reste horizontal,
           recentré sur les pastilles (14px = moitié d'une pastille de 30px). */
        @media (max-width: 640px) {
            .hapi-stepper { padding: 10px 2px; }
            .hapi-stepper li { align-items: flex-start; }
            .step-btn { flex-direction: column; align-items: center; gap: 4px; padding: 2px 3px; text-align: center; max-width: 100%; }
            /* Police réduite + repli de sécurité : « Configuration » / « Finalisation »
               tiennent ainsi dans leur colonne sans déborder ni se chevaucher. */
            .step-label { font-size: 0.64rem; white-space: normal; overflow-wrap: anywhere; line-height: 1.2; }
            .step-detail { display: none; }
            .hapi-stepper li:not(:last-child)::after { margin: 14px 3px 0; flex-basis: 6px; }
            .hapi-stepper ol { padding: 0 2px; }
        }

        /* Wizard : on n'affiche qu'un écran à la fois (!important pour surclasser les style.display inline d'app.js) */
        body[data-wizard-step="corpus"]    #activity-creation-workflow,
        body[data-wizard-step="corpus"]    #generate-section { display: none !important; }
        body[data-wizard-step="activites"] #import-section,
        body[data-wizard-step="activites"] #generator-content,
        body[data-wizard-step="activites"] #generate-section { display: none !important; }
        body[data-wizard-step="config"]    #import-section,
        body[data-wizard-step="config"]    #activity-selector { display: none !important; }

        /* Barre de navigation wizard */
        .wizard-nav { display: flex; justify-content: space-between; gap: 12px; margin: 28px 0 8px; }
        .wizard-nav button { padding: 11px 22px; border-radius: 25px; font-weight: 700; font-size: 1rem; cursor: pointer; font-family: inherit; border: none; }
        .wizard-prev { background: var(--page-bg); color: var(--text-muted); border: 1px solid var(--border); }
        .wizard-prev:hover { background: var(--border); }
        .wizard-next { background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: #fff; }
        .wizard-next:hover { filter: brightness(1.05); }
        /* Désactivé : gris EXPLICITES (pas d'opacity, qui délavait le texte à ~1,5:1).
           Exempté WCAG mais on garde ≥ 4,5 dans les deux modes (--border/--text-muted). */
        .wizard-next:disabled { background-color: var(--border); background-image: none; color: var(--text-muted); cursor: not-allowed; }
        .wizard-nav button:focus-visible { outline: 3px solid var(--hapi-green-dark) !important; outline-offset: 2px; }
        .wizard-nav [hidden] { display: none !important; }

        /* Navigation déplacée dans la barre wizard (Précédent / Suivant contextuels) :
           on masque les boutons d'origine tout en conservant leur logique (cliqués en proxy).
           On garde « Prévisualiser l'activité en cours » (#btn-global-preview). */
        #btn-go-finalisation, #btn-go-previous { display: none !important; }

        /* Titres dynamiques de l'étape 2/3 */
        body[data-wizard-step="activites"] .workflow-title-activites { display: block !important; }
        body[data-wizard-step="activites"] .workflow-title-config { display: none !important; }
        body[data-wizard-step="config"] .workflow-title-activites { display: none !important; }
        body[data-wizard-step="config"] .workflow-title-config { display: block !important; }
        /* Cible du scroll au changement d'activité : ne pas passer sous le stepper sticky (64px). */
        .workflow-title-config { scroll-margin-top: 76px; }
        /* Étape 4 (Finalisation) : titre dédié, on masque celui de la configuration */
        body[data-wizard-stepid="4"] .workflow-title-config { display: none !important; }
        body[data-wizard-stepid="4"] .workflow-title-finalisation { display: block !important; }
    `;
    document.head.appendChild(s);
}

/* ───────── Construction du bandeau + de la nav ───────── */
function build() {
    const importSection = document.getElementById('import-section');
    const content = document.querySelector('.content');
    if (!importSection || !content || document.querySelector('.hapi-stepper')) return;

    stepperEl = document.createElement('nav');
    stepperEl.className = 'hapi-stepper';
    stepperEl.setAttribute('aria-label', 'Étapes de création de l’activité');
    const ol = document.createElement('ol');
    STEPS.forEach(step => {
        const li = document.createElement('li');
        li.dataset.step = step.id;
        li.innerHTML = `
            <button type="button" class="step-btn">
                <span class="step-num" aria-hidden="true">${step.id}</span>
                <span class="step-text">
                    <span class="step-label">${step.label}</span>
                    <span class="step-detail" data-detail="${step.id}"></span>
                </span>
            </button>`;
        li.querySelector('.step-btn').addEventListener('click', () => {
            if (step.id <= reached) showStep(step.id);
        });
        ol.appendChild(li);
    });
    stepperEl.appendChild(ol);
    importSection.parentNode.insertBefore(stepperEl, importSection);

    // Barre de navigation (en bas du contenu)
    navEl = document.createElement('div');
    navEl.className = 'wizard-nav';
    navEl.innerHTML = `
        <button type="button" class="wizard-prev">← Précédent</button>
        <button type="button" class="wizard-next">Suivant : configurer →</button>`;
    navEl.querySelector('.wizard-prev').addEventListener('click', () => {
        if (viewStep === 3) {
            // Parcours linéaire : activité précédente, sinon retour aux Activités (étape 2)
            const tabs = activityTabs();
            const idx = activeActivityIndex();
            if (idx > 0) { tabs[idx - 1].click(); scrollToConfigTitle(); return; }
            showStep(2);
            return;
        }
        if (viewStep > 1) showStep(viewStep - 1);
    });
    navEl.querySelector('.wizard-next').addEventListener('click', () => {
        if (viewStep === 2) {
            forward(3);                       // Activités → Configuration
            return;
        }
        if (viewStep === 3) {
            // Parcours linéaire : activité suivante, sinon (dernière) → Finalisation
            const tabs = activityTabs();
            const idx = activeActivityIndex();
            if (idx >= 0 && idx < tabs.length - 1) { tabs[idx + 1].click(); scrollToConfigTitle(); return; }
            // Dernière activité → on déclenche le bouton d'origine (crée le dashboard
            // + avance le wizard à l'étape 4 via son écouteur existant)
            const finBtn = document.getElementById('btn-go-finalisation');
            if (finBtn) finBtn.click();
        }
    });
    content.appendChild(navEl);
}


/* Remonte au titre de l'étape 3 après un changement d'activité (saut direct
   post-rendu : un scroll smooth serait dévié par les reflows du pane). */
function scrollToConfigTitle() {
    requestAnimationFrame(() => {
        const title = document.querySelector('.workflow-title-config');
        if (title) title.scrollIntoView({ block: 'start' });
    });
}

/* ───────── Navigation ───────── */
function showStep(id) {
    viewStep = id;
    document.body.dataset.wizardStep = STEPS[id - 1].view;
    document.body.dataset.wizardStepid = id; // distingue l'étape 3 de la 4 (même vue "config")
    // Synchronisation de l'onglet actif avec l'étape visée
    const finTab = document.querySelector('.tab-btn[data-tab-target="finalisation"]');
    if (id === 4) {
        // Étape 4 : on active l'onglet Finalisation s'il existe
        if (finTab) finTab.click();
    } else if (finTab && finTab.classList.contains('active')) {
        // Retour vers la Configuration (étape 3) alors que la Finalisation est affichée :
        // on rebascule sur la 1re activité, sinon le dashboard de finalisation reste à l'écran.
        const firstActivityTab = document.querySelector('.tab-btn:not([data-tab-target="finalisation"])');
        if (firstActivityTab) firstActivityTab.click();
    }
    render();
    scrollToStepTarget(id);
}

// Amène en haut de la fenêtre le titre de l'étape cible, juste sous le bandeau d'étapes sticky.
// Étape 1 → #import-section ; étapes 2/3/4 → #activity-creation-workflow (dont le 1er enfant
// est le titre « 2. Choisissez… » / « 3. Configurez… » / « 📦 Finalisation… »).
// Écart constant (px) entre le bas du bandeau d'étapes et le haut du titre de l'étape.
const STEP_TITLE_GAP = 24;

// Titre de l'étape courante (le même que celui mis en avant dans le bandeau).
function currentStepTitle(id) {
    if (id === 1) {
        const sec = document.getElementById('import-section');
        return sec ? sec.querySelector('h2') : null;
    }
    return [
        document.querySelector('.workflow-title-activites'),
        document.querySelector('.workflow-title-config'),
        document.querySelector('.workflow-title-finalisation'),
    ].find(h => h && getComputedStyle(h).display !== 'none') || null;
}

function scrollToStepTarget(id) {
    const doScroll = () => {
        const section = id === 1
            ? document.getElementById('import-section')
            : document.getElementById('activity-creation-workflow');
        // Si la section n'est pas (encore) visible — ex. workflow pas encore activé après validation
        // du corpus — on ne scrolle pas ici (corpus-ui s'en charge une fois le workflow affiché).
        if (!section || section.offsetParent === null) return;
        const title = currentStepTitle(id) || section;
        const stepperH = stepperEl ? stepperEl.offsetHeight : 0;
        // On place le HAUT DU TITRE à STEP_TITLE_GAP sous le bandeau → écart identique pour les 4 étapes.
        const y = window.scrollY + title.getBoundingClientRect().top - stepperH - STEP_TITLE_GAP;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    };
    requestAnimationFrame(doScroll);
    // Correction après rendu asynchrone (ex. dashboard de finalisation chargé en différé) :
    // au 1er passage la page peut être trop courte → scroll clampé. On recale une fois posée.
    setTimeout(doScroll, 400);
}

function advanceReached(id) { if (id > reached) { reached = id; render(); } }
function forward(id) { advanceReached(id); showStep(id); }

function selectedCount() {
    return document.querySelectorAll('.activity-checkbox:checked').length;
}

// Onglets d'activité (hors Finalisation) + index de l'activité actuellement affichée
function activityTabs() {
    return Array.from(document.querySelectorAll('.tab-btn:not([data-tab-target="finalisation"])'));
}
function activeActivityIndex() {
    return activityTabs().findIndex(t => t.classList.contains('active'));
}

function render() {
    if (!stepperEl) return;
    stepperEl.querySelectorAll('li').forEach(li => {
        const id = Number(li.dataset.step);
        li.classList.toggle('is-done', id < viewStep);
        li.classList.toggle('is-current', id === viewStep);
        li.querySelector('.step-num').textContent = id < viewStep ? '✓' : String(id);
        const btn = li.querySelector('.step-btn');
        btn.disabled = id > reached;
        if (id === viewStep) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
    });
    const d3 = stepperEl.querySelector('[data-detail="3"]');
    if (d3) d3.textContent = detail3;

    // Barre de nav contextuelle
    if (navEl) {
        const prev = navEl.querySelector('.wizard-prev');
        const next = navEl.querySelector('.wizard-next');
        prev.hidden = viewStep === 1;                 // pas de retour sur le Corpus
        prev.disabled = false;

        if (viewStep === 2) {
            prev.textContent = '← Précédent';
            next.hidden = false;
            next.textContent = 'Suivant : configurer →';
            next.disabled = selectedCount() < 1;      // activé dès 1 activité choisie
        } else if (viewStep === 3) {
            // Navigation linéaire entre activités, puis finalisation
            const tabs = activityTabs();
            const idx = Math.max(0, activeActivityIndex());
            const isFirst = idx <= 0;
            const isLast = idx >= tabs.length - 1;
            prev.textContent = isFirst ? '← Précédent' : '← Activité précédente';
            next.hidden = false;
            next.textContent = isLast ? 'Suivant : finaliser →' : 'Activité suivante →';
            // Navigation libre entre activités ; la finalisation exige ≥ 1 activité prête
            next.disabled = isLast ? (lastReady < 1) : false;
        } else {
            // Étapes 1 et 4 : pas de bouton « Suivant » wizard
            prev.textContent = '← Précédent';
            next.hidden = true;
        }
    }
}

export function startWorkflowStepper() {
    injectStyles();
    build();
    document.body.dataset.wizardStep = 'corpus';
    render();

    // 1 → 2 : validation du corpus
    // ⚠️ On NE navigue PLUS au clic du bouton : sinon on saute à l'étape 2
    // immédiatement pendant que la transcription/extraction tourne encore en
    // arrière-plan (curseur de progression jamais visible). La navigation est
    // désormais déclenchée par corpus-ui APRÈS la construction réelle du corpus,
    // via l'événement « hapiGoToStep » (cf. écouteur plus bas).
    const workflow = document.getElementById('activity-creation-workflow');
    if (workflow) new MutationObserver(() => {
        if (workflow.classList.contains('enabled') || !workflow.classList.contains('disabled-workflow')) advanceReached(2);
    }).observe(workflow, { attributes: true, attributeFilter: ['class'] });

    // 2 → 3 (déverrouillage) + détail d'avancement
    window.addEventListener('hapiGlobalStateChange', (e) => {
        const total = e.detail ? e.detail.total : 0;
        const ready = e.detail ? e.detail.readyCount : 0;
        lastReady = ready;
        if (total >= 1) { advanceReached(3); detail3 = `${ready}/${total} prête${total > 1 ? 's' : ''}`; }
        else { detail3 = ''; }
        render();
    });

    // 3 → 4 : finalisation
    const finBtn = document.getElementById('btn-go-finalisation');
    if (finBtn) finBtn.addEventListener('click', () => {
        if (finBtn.dataset.action === 'finalisation' || /finalisation/i.test(finBtn.textContent || '')) forward(4);
    });

    // Navigation programmatique (ex. import d'une sauvegarde JSON → aller à l'étape 3)
    window.addEventListener('hapiGoToStep', (e) => {
        const id = e.detail && e.detail.id;
        if (id >= 1 && id <= STEPS.length) forward(id); // forward = déverrouille + affiche l'étape
    });

    return stepperEl;
}
