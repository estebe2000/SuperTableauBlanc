// Fichier: modules/ui/config-substep.js
// Étape 3 « guidée activité par activité » (NON destructif).
// Remplace la barre d'onglets libres par un sous-assistant : « Activité X/N : nom »
// + des pastilles par activité avec ✓ quand elle est prête. On réutilise les onglets
// existants (proxy-clic) et la validité via isPaneValid() ; aucune logique modifiée.

import { isPaneValid } from './activity-selector.js';

let substepEl = null;

function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function injectStyles() {
    if (document.getElementById('config-substep-styles')) return;
    const st = document.createElement('style');
    st.id = 'config-substep-styles';
    st.textContent = `
        .config-substep { margin: 0 0 20px; padding: 14px 16px; background: var(--hapi-green-mist, var(--hapi-green-mist));
            border: 1px solid rgba(var(--hapi-green-rgb), 0.35); border-radius: 12px; }
        .cs-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .cs-counter { font-size: 0.78rem; font-weight: 700; color: var(--hapi-accent-text); background: var(--surface);
            border: 1px solid rgba(var(--hapi-green-rgb), 0.35); padding: 3px 10px; border-radius: 14px; white-space: nowrap; }
        .cs-title { font-size: 1.15rem; font-weight: 700; color: var(--hapi-accent-text); }
        .cs-status { margin-left: auto; font-size: 0.82rem; font-weight: 700; padding: 4px 12px; border-radius: 14px; white-space: nowrap; }
        .cs-status.cs-ready { color: var(--hapi-accent-text); background: rgba(var(--hapi-green-rgb), 0.15); }
        [data-mode="dark"] .cs-status.cs-ready { color: #fff; background: var(--hapi-green-dark); }
        .cs-status.cs-pending { color: var(--text-muted); background: var(--border); }
        /* Sombre : solide — la pile chip translucide + panneau teinté + surface
           composait à ~4,47:1 (sous le seuil) et piégeait les checkers. */
        [data-mode="dark"] .cs-status.cs-pending { color: #fff; background: #454b57; }
        .cs-dots { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; }
        .cs-dot { display: flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 20px;
            border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font-family: inherit;
            font-size: 0.85rem; font-weight: 600; transition: border-color .15s, box-shadow .15s, color .15s, background .15s; }
        .cs-dot:hover { border-color: var(--hapi-green-dark); }
        .cs-dot .cs-dot-ico svg { width: 18px; height: 18px; stroke: currentColor; fill: none; vertical-align: middle; }
        .cs-dot.is-ready { color: var(--hapi-accent-text); border-color: rgba(var(--hapi-green-rgb), 0.45); background: rgba(var(--hapi-green-rgb), 0.10); }
        [data-mode="dark"] .cs-dot.is-ready { color: #fff; background: #353b46; border-color: var(--hapi-green-light); }
        .cs-dot.is-current { color: #fff; background: var(--hapi-green-dark, var(--hapi-green-dark));
            border-color: var(--hapi-green-dark, var(--hapi-green-dark)); box-shadow: 0 4px 12px rgba(var(--hapi-green-rgb),0.28); }
        .cs-dot .cs-dot-state { color: var(--hapi-accent-text); font-weight: 800; }
        .cs-dot.is-current .cs-dot-state { color: #fff; }
        .cs-dot:focus-visible { outline: 3px solid var(--hapi-green-dark) !important; outline-offset: 2px; }
        /* ✕ de suppression sur chaque pastille */
        .cs-dot-li { position: relative; display: inline-flex; }
        .cs-dot-del { position: absolute; top: -7px; right: -7px; width: 19px; height: 19px;
            border-radius: 50%; border: 1.5px solid #fff; background: #475569; color: #fff;
            font-size: 10px; line-height: 1; cursor: pointer; padding: 0;
            display: inline-flex; align-items: center; justify-content: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: transform .12s, background .12s; z-index: 2; }
        .cs-dot-del:hover { background: #334155; transform: scale(1.12); }
        .cs-dot-del:focus-visible { outline: 3px solid var(--hapi-green-dark); outline-offset: 1px; }
        /* on masque la barre d'onglets brute quand le sous-assistant est actif */
        body.has-config-substep #tabs-header { display: none !important; }
    `;
    document.head.appendChild(st);
}

function build() {
    const workspace = document.getElementById('multi-activity-workspace');
    const header = document.getElementById('tabs-header');
    if (!workspace || !header || document.querySelector('.config-substep')) return;
    substepEl = document.createElement('div');
    substepEl.className = 'config-substep';
    substepEl.setAttribute('aria-label', 'Progression des activités à configurer');
    workspace.insertBefore(substepEl, header);
    document.body.classList.add('has-config-substep');

    // Les onglets sont ajoutés/retirés sans toujours émettre hapiGlobalStateChange :
    // on ré-affiche le sous-assistant dès que la barre d'onglets change.
    new MutationObserver(() => render()).observe(header, { childList: true });
}

function render() {
    if (!substepEl) return;
    const header = document.getElementById('tabs-header');
    if (!header) { substepEl.hidden = true; return; }

    const activeAll = header.querySelector('.tab-btn.active');
    const onFinalisation = activeAll && activeAll.dataset.tabTarget === 'finalisation';
    const tabs = Array.from(header.querySelectorAll('.tab-btn')).filter(b => b.dataset.tabTarget !== 'finalisation');

    if (onFinalisation || tabs.length === 0) { substepEl.hidden = true; return; }
    substepEl.hidden = false;

    let activeIdx = tabs.findIndex(b => b.classList.contains('active'));
    if (activeIdx < 0) activeIdx = 0;
    const total = tabs.length;
    const activeBtn = tabs[activeIdx];
    const activeTitle = activeBtn ? activeBtn.textContent.trim() : '';
    const activePane = activeBtn ? document.getElementById('pane-' + activeBtn.dataset.tabTarget) : null;
    const activeReady = activePane ? !!isPaneValid(activePane) : false;

    let html = `
        <div class="cs-head">
            <span class="cs-counter">Activité ${activeIdx + 1} sur ${total}</span>
            <span class="cs-title">${escapeHtml(activeTitle)}</span>
            <span class="cs-status ${activeReady ? 'cs-ready' : 'cs-pending'}">${activeReady ? '✓ Prête' : 'À configurer'}</span>
        </div>
        <ol class="cs-dots">`;
    tabs.forEach((btn, i) => {
        const type = btn.dataset.tabTarget;
        const pane = document.getElementById('pane-' + type);
        const ready = pane ? !!isPaneValid(pane) : false;
        const isCur = i === activeIdx;
        const svg = btn.querySelector('svg') ? btn.querySelector('svg').outerHTML : '';
        const name = btn.textContent.trim();
        html += `
            <li class="cs-dot-li"><button type="button" class="cs-dot ${isCur ? 'is-current' : ''} ${ready ? 'is-ready' : ''}"
                data-target="${type}" ${isCur ? 'aria-current="step"' : ''}
                aria-label="Activité ${i + 1} : ${escapeHtml(name)}${ready ? ' (prête)' : ' (à configurer)'}">
                <span class="cs-dot-ico" aria-hidden="true">${svg}</span>
                <span class="cs-dot-name">${escapeHtml(name)}</span>
                <span class="cs-dot-state" aria-hidden="true">${ready ? '✓' : ''}</span>
            </button><button type="button" class="cs-dot-del" data-del="${type}"
                title="Retirer « ${escapeHtml(name)} »" aria-label="Retirer l'activité ${escapeHtml(name)}">✕</button></li>`;
    });
    html += `</ol>`;
    substepEl.innerHTML = html;

    substepEl.querySelectorAll('.cs-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const btn = header.querySelector(`.tab-btn[data-tab-target="${dot.dataset.target}"]`);
            if (btn) btn.click(); // proxy → switchTab() interne
            // Remonte au titre de l'étape : sans ça, on atterrit au milieu du
            // formulaire de l'activité suivante. Saut direct APRÈS rendu du pane :
            // un scroll smooth serait dévié par les reflows du contenu qui se charge.
            requestAnimationFrame(() => {
                const title = document.querySelector('.workflow-title-config');
                if (title) title.scrollIntoView({ block: 'start' });
            });
        });
    });

    // ✕ : retire l'activité → on décoche la case correspondante de l'étape 2,
    // ce qui déclenche removeTab() + la mise à jour du compteur (logique existante).
    substepEl.querySelectorAll('.cs-dot-del').forEach(del => {
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = del.dataset.del;
            const cb = document.querySelector(`.activity-checkbox[value="${type}"]`);
            if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        });
    });
}

export function startConfigSubstep() {
    injectStyles();
    const refresh = () => { build(); render(); };
    // hapiGlobalStateChange est émis à chaque changement d'onglet / de validité / d'ajout-suppression
    window.addEventListener('hapiGlobalStateChange', refresh);
    refresh(); // tentative immédiate (no-op tant que le workspace n'existe pas)
}
