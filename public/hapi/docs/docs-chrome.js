/* Chrome partagé des fiches de documentation HAPI (dossier /docs).
   Injecte, façon theme-switcher.js :
     1. le bandeau HAPI (avec le slot #hapi-theme-slot du switcher de thème),
     2. un sommaire de navigation entre les fiches,
     3. le pied de page HAPI.
   À inclure AVANT js/theme-switcher.js (qui se monte dans le slot injecté ici).
   Les couleurs suivent le thème choisi dans le switcher (tokens --hapi-* de styles.css). */
(function () {
  "use strict";

  // Liste des fiches de doc (ordre du sommaire)
  var DOCS = [
    { href: "index.html",                     label: "Vue d'ensemble" },
    { href: "hapi-avec-ia-architecture.html", label: "Architecture avec IA" },
    { href: "rag.html",                       label: "RAG — programmes officiels" },
    { href: "matomo-tracking.html",           label: "Marquage Matomo" }
  ];
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  // ── Styles propres au chrome (sommaire) ─────────────────────────────────────
  var css = document.createElement("style");
  css.textContent =
    // Alias HÉRITÉS définis sur :root : indispensable, car var(--hapi-*) utilisé
    // directement sur un descendant ne récupère pas la couleur du thème courant ;
    // l'alias, calculé au niveau :root, lui, s'hérite normalement (comme --accent).
    ":root{--doc-accent:var(--hapi-green-dark);--doc-accent-text:var(--hapi-accent-text);" +
      "--doc-accent-pale:var(--hapi-green-pale);--doc-line:var(--border);--doc-muted:var(--text-muted)}" +
    ".doc-nav{max-width:1080px;margin:18px auto 0;padding:0 18px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
    ".doc-nav .doc-nav-label{font-size:.78rem;font-weight:700;color:var(--doc-muted);text-transform:uppercase;letter-spacing:.05em;margin-right:6px}" +
    ".doc-nav a{font-size:.9rem;font-weight:600;text-decoration:none;color:var(--doc-accent-text);" +
      "background:var(--doc-accent-pale);border:1px solid var(--doc-line);border-radius:999px;padding:6px 14px;transition:background .15s,color .15s}" +
    ".doc-nav a:hover{background:var(--doc-accent);color:#fff}" +
    ".doc-nav a[aria-current=\"page\"]{background:var(--doc-accent);color:#fff;border-color:var(--doc-accent)}";
  document.head.appendChild(css);

  // ── Bandeau HAPI (identique aux autres pages, chemins relatifs en ../) ───────
  var header = document.createElement("header");
  header.innerHTML =
    '<div class="container">' +
      '<div class="hapi-badge">' +
        '<a href="../index.html" title="Retour à l\'accueil">' +
          '<img src="../images/logo-drane-normandie.png" alt="Chouette logo HAPI" class="hapi-logo">' +
        '</a>' +
      '</div>' +
      '<div class="hapi">' +
        '<a href="../index.html" title="Retour à l\'accueil"><h1>HAPI</h1></a>' +
        '<p>Le <strong>H</strong>ub d\'<strong>A</strong>ssistance <strong>P</strong>édagogique <strong>I</strong>nteractif</p>' +
        '<p><small>Documentation technique — Drane de l\'académie de Normandie</small></p>' +
      '</div>' +
      '<div class="hapi-aides">' +
        '<div id="hapi-theme-slot"></div>' +
        '<div><a href="../hapi.html" title="Qu\'est-ce que HAPI ?">Plus d\'infos</a></div>' +
        '<div><a class="out" href="https://www.tchap.gouv.fr/#/room/#HAPIHlLVM7sVIBz:agent.education.tchap.gouv.fr" title="Aide de la communauté sur le salon dédié">Tchap</a></div>' +
      '</div>' +
      '<div class="institution" title="Académie de Normandie">' +
        '<img class="logo-acnormandie" src="../images/logo_ac-normandie.svg" alt="Académie de Normandie">' +
        '<img class="logo-marianne" src="../images/marianne.svg" alt="académie de Normandie">' +
      '</div>' +
    '</div>';

  // ── Sommaire de navigation entre les fiches ─────────────────────────────────
  var nav = document.createElement("nav");
  nav.className = "doc-nav";
  nav.setAttribute("aria-label", "Sommaire de la documentation");
  var links = DOCS.map(function (d) {
    var current = d.href.toLowerCase() === here ? ' aria-current="page"' : "";
    return '<a href="' + d.href + '"' + current + ">" + d.label + "</a>";
  }).join("");
  nav.innerHTML = '<span class="doc-nav-label">Documentation</span>' + links;

  // ── Pied de page HAPI ───────────────────────────────────────────────────────
  var footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML =
    '<a href="../index.html">HAPI</a> est développé sous ' +
    '<a href="https://forge.apps.education.fr/drane-normandie/hapi/-/blob/main/LICENSE" title="GNU GPL v3.0 ou ultérieure">licence libre</a> ' +
    'sur la Forge des communs numériques éducatifs par la ' +
    '<a class="out" href="https://drane.ac-normandie.fr/">DRANE de l\'académie de Normandie</a>' +
    '<div class="footer-links">' +
      '<a href="../mentions-legales.html">Mentions légales</a>' +
      '<span class="footer-separator">|</span>' +
      '<a href="../cgu.html">CGU</a>' +
      '<span class="footer-separator">|</span>' +
      '<a class="out" href="https://forge.apps.education.fr/drane-normandie/hapi/-/issues" title="Signaler un bug" target="_blank">Tickets</a>' +
      '<span class="footer-separator">|</span>' +
      '<a class="out" href="https://forge.apps.education.fr/drane-normandie/hapi/" title="Espace de développement" target="_blank">Forge</a>' +
    '</div>' +
    '<div class="footer-gia-container">' +
      '<img src="../images/gia.png" alt="Généré par IA" class="gia-icon" title="Plateforme entièrement codée avec des IA">' +
    '</div>';

  // ── Montage : bandeau + sommaire en tête, pied de page en fin ───────────────
  document.body.insertBefore(nav, document.body.firstChild);
  document.body.insertBefore(header, document.body.firstChild);
  document.body.appendChild(footer);

  // ── Zoom & déplacement des diagrammes Mermaid (svg-pan-zoom) ────────────────
  setupMermaidPanZoom();

  function setupMermaidPanZoom() {
    var boxes = document.querySelectorAll(".mermaid");
    if (!boxes.length) return;

    // Pan/zoom MAISON (pas de dépendance externe) : transform CSS sur le SVG,
    // conteneur à hauteur fixe qui rogne. Robuste quelle que soit la version Mermaid.
    var st = document.createElement("style");
    st.textContent =
      ".mermaid{position:relative;height:min(72vh,640px);overflow:hidden;cursor:grab;touch-action:none}" +
      ".mermaid.is-panning{cursor:grabbing}" +
      ".mermaid > svg{width:100%!important;height:100%!important;max-width:none!important;transform-origin:0 0;will-change:transform}" +
      ".mermaid-hint{position:absolute;right:10px;top:8px;z-index:6;font-size:.72rem;" +
        "color:var(--text-muted);background:var(--surface);border:1px solid var(--border);" +
        "border-radius:6px;padding:2px 8px;pointer-events:none;opacity:.9}" +
      ".pz-ctrl{position:absolute;left:10px;bottom:10px;z-index:6;display:flex;flex-direction:column;gap:4px}" +
      ".pz-ctrl button{width:30px;height:30px;border:1px solid var(--border);background:var(--surface);" +
        "color:var(--text);border-radius:7px;font-size:17px;font-weight:700;line-height:1;cursor:pointer;" +
        "display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.12)}" +
      ".pz-ctrl button:hover{background:var(--hapi-green-pale);color:var(--hapi-accent-text);border-color:var(--hapi-green-dark)}";
    document.head.appendChild(st);

    boxes.forEach(function (box) { whenSvgReady(box, function (svg) { initPanZoom(box, svg); }); });

    function whenSvgReady(box, cb) {
      // Mermaid insère puis REMPLACE son <svg> pendant le rendu. On débounce :
      // on n'initialise qu'après stabilisation (plus de mutation pendant 300 ms),
      // sur le <svg> final — sinon le pan/zoom est posé sur un SVG transitoire,
      // puis effacé par Mermaid.
      var timer = null;
      function schedule() {
        if (!box.querySelector("svg")) return;
        clearTimeout(timer);
        timer = setTimeout(function () { mo.disconnect(); cb(box.querySelector("svg")); }, 300);
      }
      var mo = new MutationObserver(schedule);
      mo.observe(box, { childList: true, subtree: true });
      schedule(); // cas où le <svg> est déjà là
    }

    function initPanZoom(box, svg) {
      if (box.__pzDone) return;
      box.__pzDone = true;
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.maxWidth = "none";

      var scale = 1, tx = 0, ty = 0, drag = false, sx = 0, sy = 0;
      function apply() { svg.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; }
      function clamp(v) { return Math.min(12, Math.max(0.3, v)); }
      function zoomAt(mx, my, factor) {
        var ns = clamp(scale * factor);
        tx = mx - (mx - tx) * (ns / scale);
        ty = my - (my - ty) * (ns / scale);
        scale = ns; apply();
      }
      box.addEventListener("wheel", function (e) {
        e.preventDefault();
        var r = box.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      }, { passive: false });
      box.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".pz-ctrl")) return;
        drag = true; sx = e.clientX - tx; sy = e.clientY - ty;
        box.classList.add("is-panning");
        if (box.setPointerCapture) box.setPointerCapture(e.pointerId);
      });
      box.addEventListener("pointermove", function (e) { if (!drag) return; tx = e.clientX - sx; ty = e.clientY - sy; apply(); });
      function endDrag() { drag = false; box.classList.remove("is-panning"); }
      box.addEventListener("pointerup", endDrag);
      box.addEventListener("pointercancel", endDrag);

      var ctrl = document.createElement("div");
      ctrl.className = "pz-ctrl";
      function mid(axis) { var r = box.getBoundingClientRect(); return axis === "x" ? r.width / 2 : r.height / 2; }
      function mkBtn(label, title, fn) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = label; b.title = title; b.setAttribute("aria-label", title);
        b.addEventListener("click", fn); return b;
      }
      ctrl.appendChild(mkBtn("+", "Zoom avant", function () { zoomAt(mid("x"), mid("y"), 1.3); }));
      ctrl.appendChild(mkBtn("−", "Zoom arrière", function () { zoomAt(mid("x"), mid("y"), 1 / 1.3); }));
      ctrl.appendChild(mkBtn("↺", "Réinitialiser la vue", function () { scale = 1; tx = 0; ty = 0; apply(); }));
      box.appendChild(ctrl);

      var hint = document.createElement("div");
      hint.className = "mermaid-hint";
      hint.textContent = "molette = zoom · glisser = déplacer";
      box.appendChild(hint);

      apply();
    }
  }
})();
