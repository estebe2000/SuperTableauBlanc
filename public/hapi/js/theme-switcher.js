/* Switcher de thème HAPI — partagé par toutes les pages.
   Injecte la pilule « Thème » (mode clair/sombre + 7 couleurs) dans le slot
   <div id="hapi-theme-slot"></div> du bandeau (.hapi-aides).
   - data-color-only="true" sur le slot : pas de segment Clair/Sombre
     (pages dont le mode sombre n'est pas encore supporté, ex. générateurs SCORM).
   - Persistance : localStorage hapi-theme (couleur) + hapi-mode (clair/sombre),
     appliquées au chargement par le script anti-flash du <head> de chaque page.
   Les styles (pilule, panneau repliable, gommettes) sont dans css/styles.css. */

// Détection du mode Iframe / Intégration dans IAcadémie
if (window.self !== window.top) {
    document.documentElement.classList.add('is-embedded');
}

(function () {
    var slot = document.getElementById('hapi-theme-slot');
    if (!slot) return;
    var colorOnly = slot.getAttribute('data-color-only') === 'true';

    var THEMES = [
        ['vert',           'Vert HAPI'],
        ['institutionnel', 'Design institutionnel (bleu France)'],
        ['ocean',          'Océan'],
        ['violet',         'Violet'],
        ['terracotta',     'Terracotta'],
        ['indigo',         'Indigo'],
        ['framboise',      'Framboise']
    ];
    var ATTR = 'class="switcher-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    var SUN  = '<svg ' + ATTR + '><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>';
    var MOON = '<svg ' + ATTR + '><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var PAL  = '<svg ' + ATTR + '><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C22 6 17.5 2 12 2z"/></svg>';

    var dotsHtml = THEMES.map(function (t) {
        return '<button type="button" class="theme-dot" data-set-theme="' + t[0] + '" title="' + t[1] + '" aria-label="Thème ' + t[1] + '" tabindex="-1"></button>';
    }).join('');
    var modeHtml = colorOnly ? '' :
        '<div class="mode-seg" role="group" aria-label="Mode d\'affichage">' +
            '<button type="button" class="hapi-mode-btn" data-set-mode="light" aria-pressed="true"  tabindex="-1">' + SUN + ' Clair</button>' +
            '<button type="button" class="hapi-mode-btn" data-set-mode="dark"  aria-pressed="false" tabindex="-1">' + MOON + ' Sombre</button>' +
        '</div><span class="sep" aria-hidden="true"></span>';

    slot.innerHTML =
        '<div class="hapi-theme-switcher inline" data-open="false">' +
            '<div class="theme-panel" id="theme-panel">' + modeHtml +
                '<div class="theme-dots" role="group" aria-label="Couleurs disponibles">' + dotsHtml + '</div>' +
            '</div>' +
            '<button type="button" class="theme-toggle" aria-expanded="false" aria-controls="theme-panel" aria-label="Choisir le thème de l\'interface">' +
                PAL + ' <span class="theme-toggle-text">Thème</span>' +
            '</button>' +
        '</div>';

    var KEY = 'hapi-theme';
    var MODE_KEY = 'hapi-mode';
    var root = document.documentElement;
    var switcher = slot.querySelector('.hapi-theme-switcher');
    var toggle = switcher.querySelector('.theme-toggle');
    var dots = Array.prototype.slice.call(switcher.querySelectorAll('.theme-dot'));
    var modeBtns = Array.prototype.slice.call(switcher.querySelectorAll('.hapi-mode-btn'));

    function apply(theme) {
        if (theme && theme !== 'vert') root.setAttribute('data-theme', theme);
        else root.removeAttribute('data-theme');
        var active = theme || 'vert';
        dots.forEach(function (d) {
            d.setAttribute('aria-pressed', String(d.dataset.setTheme === active));
        });
    }
    function applyMode(mode) {
        if (mode === 'dark') root.setAttribute('data-mode', 'dark');
        else root.removeAttribute('data-mode');
        var active = mode || 'light';
        modeBtns.forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.dataset.setMode === active));
        });
    }
    function setOpen(open) {
        switcher.setAttribute('data-open', String(open));
        toggle.setAttribute('aria-expanded', String(open));
        // Contrôles focusables uniquement quand le panneau est ouvert
        dots.forEach(function (d) { d.setAttribute('tabindex', open ? '0' : '-1'); });
        modeBtns.forEach(function (b) { b.setAttribute('tabindex', open ? '0' : '-1'); });
    }

    toggle.addEventListener('click', function () {
        var willOpen = switcher.getAttribute('data-open') !== 'true';
        setOpen(willOpen);
        if (willOpen) {
            var cur = switcher.querySelector('.hapi-mode-btn[aria-pressed="true"]') ||
                      switcher.querySelector('.theme-dot[aria-pressed="true"]') || dots[0];
            if (cur) cur.focus();
        }
    });
    dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
            var theme = dot.dataset.setTheme;
            try { localStorage.setItem(KEY, theme); } catch (err) {}
            apply(theme);
            setOpen(false);            // repli automatique après choix de couleur
            toggle.focus();
        });
    });
    modeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var mode = btn.dataset.setMode;
            try { localStorage.setItem(MODE_KEY, mode); } catch (err) {}
            applyMode(mode);           // panneau laissé ouvert : mode + couleur se choisissent ensemble
        });
    });
    // Repli au clic en dehors
    document.addEventListener('click', function (e) {
        if (switcher.getAttribute('data-open') === 'true' && !switcher.contains(e.target)) {
            setOpen(false);
        }
    });
    // Échap = fermer ; flèches = naviguer entre gommettes
    switcher.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && switcher.getAttribute('data-open') === 'true') {
            setOpen(false); toggle.focus();
        } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && document.activeElement.classList.contains('theme-dot')) {
            e.preventDefault();
            var i = dots.indexOf(document.activeElement);
            var n = e.key === 'ArrowRight' ? (i + 1) % dots.length : (i - 1 + dots.length) % dots.length;
            dots[n].focus();
        }
    });

    var saved = 'vert', savedMode = 'light';
    try { saved = localStorage.getItem(KEY) || 'vert'; } catch (err) {}
    try { savedMode = localStorage.getItem(MODE_KEY) || 'light'; } catch (err) {}
    apply(saved);
    if (!colorOnly) applyMode(savedMode);
})();
