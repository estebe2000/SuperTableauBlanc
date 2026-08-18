// Fichier: modules/utils/math-editor.js

import { logger } from './logger.js';

let MQ = null;
let mathFields = {}; 

/**
 * Insère un symbole ou une commande LaTeX de manière sécurisée dans un TEXTAREA
 */
function insertSymbol(fieldId, cmd) {
    const textarea = document.getElementById(fieldId);
    if (!textarea) {
        logger.error(`Textarea introuvable pour l'insertion LaTeX : ${fieldId}`);
        return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    // Insertion propre
    textarea.value = text.substring(0, start) + cmd + text.substring(end);
    
    // Calcul intelligent de la nouvelle position du curseur
    let newPos = start + cmd.length;
    if (cmd.includes('{}')) {
        newPos = start + cmd.indexOf('{}') + 1;
    } else if (cmd.includes('()')) {
        newPos = start + cmd.indexOf('()') + 1;
    } else if (cmd.includes('[]')) {
        newPos = start + cmd.indexOf('[]') + 1;
    }
    
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
    
    // CRITIQUE : Simule une vraie frappe clavier pour réveiller setupMathPreview
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertTextCommand(fieldId) {
    insertSymbol(fieldId, '\\text{}');
}

export function initMathEditor() {
    if (window.MathQuill) {
        MQ = MathQuill.getInterface(2);
        logger.log("✅ MathQuill initialisé");
    } else {
        logger.warn("MathQuill non détecté");
    }
}

/**
 * Construit le HTML pour une barre d'outils LaTeX complète.
 */
export function createMathToolbar(targetFieldId) {
    const btn = (code, desc, cmd) => {
        let action = "insert";
        let cmdAttr = "";
        
        if (cmd === '\\text{}') {
            action = "text";
        } else {
            const safeCmd = cmd.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
            cmdAttr = `data-cmd="${safeCmd}"`;
        }
        
        return `
        <button type="button" class="toolbar-btn" data-action="${action}" data-target="${targetFieldId}" ${cmdAttr}>
            <span class="latex-code">${code}</span>
            <span class="latex-desc">${desc}</span>
        </button>`;
    };
    
    const uid = `tb-${targetFieldId}`;

    return `
    <div class="math-toolbar">
        <div class="toolbar-nav">
            <button type="button" class="toolbar-tab-btn active" data-tab="base-${uid}">🔢 Base</button>
            <button type="button" class="toolbar-tab-btn" data-tab="ops-${uid}">➗ Opérations</button>
            <button type="button" class="toolbar-tab-btn" data-tab="func-${uid}">📊 Fonctions</button>
            <button type="button" class="toolbar-tab-btn" data-tab="geo-${uid}">📐 Géométrie</button>
            <button type="button" class="toolbar-tab-btn" data-tab="greek-${uid}">🏛️ Grec</button>
            <button type="button" class="toolbar-tab-btn" data-tab="phys-${uid}">⚡ Physique</button>
            <button type="button" class="toolbar-tab-btn" data-tab="chem-${uid}">🧪 Chimie</button>
            <button type="button" class="toolbar-tab-btn" data-tab="delim-${uid}">🔗 Délimiteurs</button>
        </div>
        
        <div id="base-${uid}" class="toolbar-tab-content" style="display: block;">
            <div class="toolbar-buttons-grid">
                ${btn('\\text{abc}', 'Texte', '\\text{}')} ${btn('\\frac{a}{b}', 'Fraction', '\\frac{}{} ')} ${btn('x^2', 'Exposant', '^2')}
                ${btn('x_{1}', 'Indice', '_{}')} ${btn('\\sqrt{x}', 'Racine', '\\sqrt{}')} ${btn('\\sqrt[n]{x}', 'Racine n-ième', '\\sqrt[]{}')}
            </div>
        </div>
        
        <div id="ops-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('\\times', 'Multiplication', '\\times')} ${btn('\\div', 'Division', '\\div')} ${btn('\\pm', 'Plus/moins', '\\pm')}
                ${btn('\\leq', 'Inf. égal', '\\leq')} ${btn('\\geq', 'Sup. égal', '\\geq')} ${btn('\\neq', 'Différent', '\\neq')}
                ${btn('\\approx', 'Environ', '\\approx')} ${btn('\\infty', 'Infini', '\\infty')}
            </div>
        </div>
        
        <div id="func-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('\\sin', 'Sinus', '\\sin')} ${btn('\\cos', 'Cosinus', '\\cos')} ${btn('\\tan', 'Tangente', '\\tan')}
                ${btn('\\ln', 'Log népérien', '\\ln')} ${btn('\\log', 'Logarithme', '\\log')} ${btn('\\exp', 'Exponentielle', '\\exp')}
                ${btn('\\lim', 'Limite', '\\lim_{x \\to }')} ${btn('\\sum', 'Somme', '\\sum_{i=1}^{n}')}
            </div>
        </div>
        
        <div id="geo-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('\\vec{u}', 'Vecteur', '\\vec{}')} ${btn('\\overrightarrow{AB}', 'Vecteur AB', '\\overrightarrow{}')} ${btn('\\angle', 'Angle', '\\angle')}
                ${btn('\\widehat{ABC}', 'Angle ABC', '\\widehat{}')} ${btn('\\parallel', 'Parallèle', '\\parallel')} ${btn('\\perp', 'Perpendiculaire', '\\perp')}
            </div>
        </div>
        
        <div id="greek-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('\\alpha', 'Alpha', '\\alpha')} ${btn('\\beta', 'Beta', '\\beta')} ${btn('\\gamma', 'Gamma', '\\gamma')}
                ${btn('\\delta', 'Delta', '\\delta')} ${btn('\\theta', 'Theta', '\\theta')} ${btn('\\pi', 'Pi', '\\pi')}
                ${btn('\\sigma', 'Sigma', '\\sigma')} ${btn('\\phi', 'Phi', '\\phi')}
            </div>
        </div>
        
        <div id="phys-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('\\vec{F}', 'Force', '\\vec{F}')} ${btn('\\vec{v}', 'Vitesse', '\\vec{v}')} ${btn('\\vec{a}', 'Accélération', '\\vec{a}')}
                ${btn('\\frac{d}{dt}', 'Dérivée', '\\frac{d}{dt}')} ${btn('\\lambda', 'Long. onde', '\\lambda')} ${btn('\\omega', 'Pulsation', '\\omega')}
            </div>
        </div>
        
        <div id="chem-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('H_2O', 'Eau', '\\text{H}_2\\text{O}')} ${btn('H^+', 'Ion H+', '\\text{H}^+')} ${btn('OH^-', 'Ion OH-', '\\text{OH}^-')}
                ${btn('\\rightarrow', 'Réaction', '\\rightarrow')} ${btn('\\rightleftharpoons', 'Équilibre', '\\rightleftharpoons')}
            </div>
        </div>
        
        <div id="delim-${uid}" class="toolbar-tab-content" style="display: none;">
            <div class="toolbar-buttons-grid">
                ${btn('( )', 'Parenthèses', '\\left(  \\right)')} ${btn('[ ]', 'Crochets', '\\left[  \\right]')} ${btn('\\{ \\}', 'Accolades', '\\left\\{  \\right\\}')}
            </div>
        </div>
    </div>
    `;
}

/**
 * Délégation des clics pour la barre d'outils.
 */
export function handleToolbarClick(event) {
    const target = event.target;
    
    // 1. Onglets
    const tabBtn = target.closest('.toolbar-tab-btn');
    if (tabBtn) {
        event.preventDefault();
        const toolbar = tabBtn.closest('.math-toolbar');
        const tabName = tabBtn.dataset.tab;
        
        toolbar.querySelectorAll('.toolbar-tab-content').forEach(c => c.style.display = 'none');
        toolbar.querySelectorAll('.toolbar-tab-btn').forEach(b => b.classList.remove('active'));
        
        const tabContent = document.getElementById(tabName);
        if (tabContent) tabContent.style.display = 'block';
        tabBtn.classList.add('active');
        return;
    }
    
    // 2. Boutons d'insertion
    const symbolBtn = target.closest('.toolbar-btn');
    if (symbolBtn) {
        event.preventDefault(); // IMPORTANT : empêche le submit éventuel du formulaire
        const action = symbolBtn.dataset.action;
        const targetId = symbolBtn.dataset.target;
        
        if (action === 'insert') {
            const cmd = symbolBtn.dataset.cmd.replace(/\\\\/g, '\\');
            insertSymbol(targetId, cmd); 
        } else if (action === 'text') {
            insertTextCommand(targetId); 
        }
    }
}