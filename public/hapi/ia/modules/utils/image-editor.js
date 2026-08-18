let fabricCanvas = null;

// --- VARIABLES POUR L'HISTORIQUE ---
let history = [];
let redoStack = [];
let isStateSaving = false;

// ==========================================
// 🏗️ INJECTION DYNAMIQUE DU HTML
// ==========================================
function _injectModalHTML() {
    if (document.getElementById('fabric-modal')) return;

    const modalHTML = `
    <div id="fabric-modal" style="display:none; position:fixed; inset:0; z-index:1000;
         background:rgba(0,0,0,0.55); align-items:center; justify-content:center;
         flex-direction:column; gap:12px;">

      <div style="
        display:inline-flex; align-items:center; gap:2px;
        background:var(--surface); border:0.5px solid var(--border);
        border-radius:12px; padding:6px 8px;
        box-shadow:0 4px 20px rgba(0,0,0,0.15);
        position:relative; color: var(--text);
      " id="fab-toolbar">

        <button class="fab-btn active" id="fab-btn-select" title="Sélectionner" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-7 1-4 7z"/></svg>
        </button>

        <div class="fab-tool-wrap" style="position:relative; display:flex; align-items:center;">
          <button class="fab-btn" id="fab-btn-draw" title="Dessin libre" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <div class="fab-submenu" id="fab-sub-draw" style="display:none; align-items:center; gap:4px; margin-left:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>
            <input type="range" id="fab-brush-size" min="1" max="30" value="4" style="width:80px; accent-color:var(--hapi-green); cursor:pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><circle cx="12" cy="12" r="7"/></svg>
            <span id="fab-brush-label" style="font-size:11px;color:#6b7280;min-width:26px;">4px</span>
          </div>
        </div>

        <button class="fab-btn" id="fab-btn-text" title="Texte" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        </button>

        <button class="fab-btn" id="fab-btn-rect" title="Cadre" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
        </button>

       <div class="fab-tool-wrap" style="display:flex; align-items:center;">
         <button class="fab-btn" id="fab-btn-arrow" title="Flèche" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
         </button>
         <div class="fab-submenu" id="fab-sub-arrow" style="display:none; align-items:center; gap:4px; margin-left:4px;">
           <select id="fab-arrow-style" style="height:28px; padding:0 6px; font-size:12px; border:0.5px solid var(--border); border-radius:6px; background:var(--surface); color:#374151; cursor:pointer;">
             <option value="solid">→ Pleine</option>
             <option value="dashed">⇢ Tiretée</option>
             <option value="dotted">⋯ Pointillée</option>
           </select>
           <button id="fab-btn-arrow-insert" style="height:28px; padding:0 10px; background:var(--hapi-grad-a); color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;">Insérer</button>
         </div>
       </div>

        <div style="width:0.5px;height:24px;background:var(--border);margin:0 4px;flex-shrink:0;"></div>

        <label style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:8px; cursor:pointer; border:none; background:transparent; position:relative; flex-shrink:0;" title="Couleur">
          <span id="fab-color-swatch" style="width:18px; height:18px; border-radius:50%; background:#000000; border:1.5px solid #ffffff; box-shadow:0 0 0 1px var(--border); pointer-events:none; display:block;"></span>
          <input type="color" id="fab-color" value="#000000" style="position:absolute; opacity:0; width:100%; height:100%; cursor:pointer;">
        </label>

        <button class="fab-btn" id="fab-btn-fill" title="Remplir l'objet sélectionné" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 11c0 4-7 11-7 11S5 15 5 11a7 7 0 0114 0z"/>
            <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none"/>
            <path d="M21 21c0-1.5-1-2-2-3s-1-1.5-1-3"/>
          </svg>
        </button>

        <div style="width:0.5px;height:24px;background:var(--border);margin:0 4px;flex-shrink:0;"></div>

        <button class="fab-btn" id="fab-btn-rotate" title="Pivoter (90°)" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
          </svg>
        </button>

        <button class="fab-btn" id="fab-btn-undo" title="Annuler (Ctrl+Z)" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
        </button>

        <button class="fab-btn" id="fab-btn-redo" title="Rétablir (Ctrl+Y)" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 014-4h12"/></svg>
        </button>

        <div style="width:0.5px;height:24px;background:var(--border);margin:0 4px;flex-shrink:0;"></div>

        <button class="fab-btn" id="fab-btn-delete" title="Supprimer l'élément sélectionné (Suppr)" style="color:#dc2626; cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
        </button>

        <button class="fab-btn" id="fab-btn-clear" title="Tout effacer (sauf le fond)" style="color:#9ca3af; cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"/><path d="M6.5 17.5l3-3"/>
          </svg>
        </button>

        <div style="width:0.5px;height:24px;background:var(--border);margin:0 4px;flex-shrink:0;"></div>

        <button class="fab-btn" id="fab-btn-cancel" title="Fermer sans sauvegarder" style="cursor:pointer; border:none; background:transparent; padding:6px; border-radius:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <button id="fab-btn-save" style="display:flex; align-items:center; gap:6px; height:36px; padding:0 14px; background:var(--hapi-grad-a); color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; margin-left:4px; flex-shrink:0; transition:background 0.12s;" title="Sauvegarder">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Sauvegarder
        </button>

      </div>
      <div style="box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; background: var(--surface); max-width: 95vw;">
          <canvas id="fabric-canvas"></canvas>
      </div>
    </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHTML;
    document.body.appendChild(wrapper.firstElementChild);

    const style = document.createElement('style');
    style.innerHTML = `
      .fab-btn { color: var(--text); }
      .fab-btn:hover { background: rgba(125,125,125,0.28) !important; }
      .fab-btn.active { background: var(--hapi-grad-a) !important; color: #fff !important; }
    `;
    document.head.appendChild(style);
}

// ==========================================
// 🚀 OUVERTURE DE L'ÉDITEUR
// ==========================================
export function openFabricEditor(originalBase64, savedJSON, onSaveCallback) {
    _injectModalHTML();

    const modal = document.getElementById('fabric-modal');
    modal.style.display = 'flex';

    if (!fabricCanvas) {
        fabricCanvas = new fabric.Canvas('fabric-canvas', { 
            isDrawingMode: false
        });
        
        // 🛠️ MODERNISATION DES CONTRÔLES (Curseur pointeur / main forcé)
        fabric.Object.prototype.set({
            borderColor: '#185FA5',
            cornerColor: '#185FA5',
            cornerStrokeColor: '#ffffff',
            cornerSize: 12,
            padding: 5,
            transparentCorners: false,
            cornerStyle: 'circle'
        });

        // ✅ CURSEUR DE ROTATION FORCÉ
        if (fabric.Object.prototype.controls && fabric.Object.prototype.controls.mtr) {
            fabric.Object.prototype.controls.mtr.cursorStyle = 'pointer'; 
        }

        _initFabricToolbar();
        _initHistoryListeners();
    }

    fabricCanvas.clear();
    fabricCanvas.isDrawingMode = false;
    
    // 🧹 Réinitialisation des menus et boutons au démarrage
    const subDraw = document.getElementById('fab-sub-draw');
    const subArrow = document.getElementById('fab-sub-arrow');
    if (subDraw) subDraw.style.display = 'none';
    if (subArrow) subArrow.style.display = 'none';
    
    document.querySelectorAll('.fab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('fab-btn-select').classList.add('active');

    history = [];
    redoStack = [];

// 🌟 NOUVELLE LOGIQUE DE CHARGEMENT
    if (savedJSON) {
        // Si on a un historique, on recharge tout (fond + objets vectoriels)
        fabricCanvas.loadFromJSON(savedJSON, () => {
            
            // 🛠️ CORRECTION : On redimensionne le canvas à la taille de l'image restaurée
            const bg = fabricCanvas.backgroundImage;
            if (bg) {
                // On vérifie si l'image avait été pivotée (pour inverser largeur/hauteur si besoin)
                const isRotated = bg.angle === 90 || bg.angle === 270;
                const canvasW = isRotated ? (bg.height * bg.scaleY) : (bg.width * bg.scaleX);
                const canvasH = isRotated ? (bg.width * bg.scaleX) : (bg.height * bg.scaleY);
                
                fabricCanvas.setWidth(canvasW);
                fabricCanvas.setHeight(canvasH);
            }

            fabricCanvas.renderAll();
            saveState(); // On initialise le undo/redo avec cet état
        });
    } else {
        // Sinon, c'est une nouvelle image, on charge juste le fond (votre logique actuelle)
        	fabric.Image.fromURL(originalBase64, function(img) {
            const maxWidth = window.innerWidth * 0.85; 
            const maxHeight = window.innerHeight * 0.75;
            let scale = 1;

            if (img.width > maxWidth || img.height > maxHeight) {
                scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            }

            // Définit la taille exacte du canvas
            fabricCanvas.setWidth(img.width * scale);
            fabricCanvas.setHeight(img.height * scale);
            
            // 🛠️ RETOUR À LA LOGIQUE ORIGINELLE (100% SANS ROGNAGE)
            fabricCanvas.setBackgroundImage(img, () => {
                fabricCanvas.renderAll();
                saveState();
            }, { 
                scaleX: scale, 
                scaleY: scale,
                originX: 'left',
                originY: 'top',
                left: 0,
                top: 0
            });
        });
    }

    // 🌟 NOUVELLE LOGIQUE DE SAUVEGARDE
    document.getElementById('fab-btn-save').onclick = () => {
        // On génère l'image aplatie pour l'affichage public
        const finalBase64 = fabricCanvas.toDataURL({ format: 'jpeg', quality: 0.9 });
        
        // On génère le JSON pour pouvoir rééditer plus tard
        const jsonState = JSON.stringify(fabricCanvas.toJSON());
        
        modal.style.display = 'none';
        
        // On renvoie les DEUX formats
        onSaveCallback(finalBase64, jsonState);
    };

    document.getElementById('fab-btn-cancel').onclick = () => {
        modal.style.display = 'none';
    };
}

// ==========================================
// 🛠️ BARRE D'OUTILS ET NOUVELLES FONCTIONS
// ==========================================
function _initFabricToolbar() {
    const colorPicker = document.getElementById('fab-color');
    const colorSwatch = document.getElementById('fab-color-swatch');
    const brushSizeInput = document.getElementById('fab-brush-size');
    const brushLabel = document.getElementById('fab-brush-label');
    
    const updateSubmenus = (activeTool) => {
        const subDraw = document.getElementById('fab-sub-draw');
        const subArrow = document.getElementById('fab-sub-arrow');
        if (subDraw) subDraw.style.display = (activeTool === 'draw') ? 'flex' : 'none';
        if (subArrow) subArrow.style.display = (activeTool === 'arrow') ? 'flex' : 'none';
    };

    const setActiveBtn = (id) => {
        document.querySelectorAll('.fab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    };

    // 1. DESSIN LIBRE & ÉPAISSEUR
    document.getElementById('fab-btn-draw').onclick = () => {
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush.color = colorPicker.value;
        fabricCanvas.freeDrawingBrush.width = parseInt(brushSizeInput.value, 10);
        setActiveBtn('fab-btn-draw');
        updateSubmenus('draw'); 
    };

    brushSizeInput.oninput = (e) => {
        const val = e.target.value;
        brushLabel.innerText = val + 'px';
        if (fabricCanvas.freeDrawingBrush) {
            fabricCanvas.freeDrawingBrush.width = parseInt(val, 10);
        }
    };

    // 2. OUTIL TEXTE
    document.getElementById('fab-btn-text').onclick = () => {
        fabricCanvas.isDrawingMode = false;
        const text = new fabric.IText('Texte ici', {
            left: fabricCanvas.width / 2, top: fabricCanvas.height / 2,
            fill: colorPicker.value, fontSize: 28, fontWeight: 'bold', fontFamily: 'Arial'
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        setActiveBtn('fab-btn-select'); 
        updateSubmenus('none'); 
    };

    // 3. OUTIL CADRE
    document.getElementById('fab-btn-rect').onclick = () => {
        fabricCanvas.isDrawingMode = false;
        const rect = new fabric.Rect({
            left: fabricCanvas.width / 2 - 50, top: fabricCanvas.height / 2 - 40,
            width: 100, height: 80, fill: 'transparent', 
            stroke: colorPicker.value, strokeWidth: parseInt(brushSizeInput.value, 10) || 4
        });
        fabricCanvas.add(rect);
        fabricCanvas.setActiveObject(rect);
        setActiveBtn('fab-btn-select');
        updateSubmenus('none'); 
    };

    // 4. OUTIL FLÈCHE AVEC STYLES
    document.getElementById('fab-btn-arrow-insert').onclick = () => {
        fabricCanvas.isDrawingMode = false;
        const style = document.getElementById('fab-arrow-style').value;
        addArrow(colorPicker.value, parseInt(brushSizeInput.value, 10) || 4, style);
        setActiveBtn('fab-btn-select');
        updateSubmenus('none'); 
    };
    
    document.getElementById('fab-btn-arrow').onclick = () => {
        fabricCanvas.isDrawingMode = false;
        setActiveBtn('fab-btn-arrow');
        updateSubmenus('arrow'); 
    };

    // 5. OUTIL SÉLECTION
    document.getElementById('fab-btn-select').onclick = () => {
        fabricCanvas.isDrawingMode = false;
        setActiveBtn('fab-btn-select');
        updateSubmenus('none'); 
    };

    // 6. POT DE PEINTURE
    document.getElementById('fab-btn-fill').onclick = () => {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && activeObj.type !== 'image' && activeObj.type !== 'path') {
            activeObj.set('fill', colorPicker.value);
            fabricCanvas.renderAll();
            saveState();
        }
    };

    // 7. GESTION DES COULEURS
    colorPicker.oninput = (e) => {
        const color = e.target.value;
        colorSwatch.style.background = color; 
        
        if (fabricCanvas.isDrawingMode) {
            fabricCanvas.freeDrawingBrush.color = color;
        }
        
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj) {
            if (activeObj.type === 'i-text') activeObj.set('fill', color);
            else if (activeObj.type === 'group') {
                activeObj._objects.forEach(obj => {
                    if (obj.type === 'line') obj.set('stroke', color);
                    else if (obj.type === 'triangle' && obj.fill !== 'transparent') obj.set('fill', color);
                });
            } else {
                activeObj.set('stroke', color);
            }
            fabricCanvas.renderAll();
            saveState();
        }
    };

    // 8. PIVOTER (🔄)
    document.getElementById('fab-btn-rotate').onclick = () => {
        _rotateCanvas();
    };

    // 9. SUPPRIMER L'ÉLÉMENT SÉLECTIONNÉ
    document.getElementById('fab-btn-delete').onclick = () => {
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length) {
            activeObjects.forEach(obj => fabricCanvas.remove(obj));
            fabricCanvas.discardActiveObject();
            saveState();
        }
    };
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj && !activeObj.isEditing) {
                document.getElementById('fab-btn-delete').click();
            }
        }
    });

    // 10. TOUT EFFACER
    document.getElementById('fab-btn-clear').onclick = () => {
        fabricCanvas.clearContext(fabricCanvas.contextTop);
        const objects = fabricCanvas.getObjects();
        objects.forEach(obj => fabricCanvas.remove(obj));
        saveState();
    };

    // 11. HISTORIQUE
    document.getElementById('fab-btn-undo').onclick = undo;
    document.getElementById('fab-btn-redo').onclick = redo;
}

// ==========================================
// 🔄 PIVOTER LE CANVAS (90°)
// ==========================================
function _rotateCanvas() {
    const currentWidth = fabricCanvas.width;
    const currentHeight = fabricCanvas.height;
    
    // Inverser les dimensions du canvas
    fabricCanvas.setDimensions({ width: currentHeight, height: currentWidth });

    // Faire pivoter l'image de fond (Logique sans origine centrée)
    const bg = fabricCanvas.backgroundImage;
    if (bg) {
        const newAngle = (bg.angle || 0) + 90;
        bg.set({ angle: newAngle });
        
        const normalizedAngle = newAngle % 360;
        // On récupère la taille *d'origine* de l'image à l'échelle
        const W = bg.width * bg.scaleX;
        const H = bg.height * bg.scaleY;
        
        // Décalage pour remettre l'image dans le cadre
        if (normalizedAngle === 0) {
            bg.set({ left: 0, top: 0 });
        } else if (normalizedAngle === 90) {
            bg.set({ left: H, top: 0 });
        } else if (normalizedAngle === 180) {
            bg.set({ left: W, top: H });
        } else if (normalizedAngle === 270) {
            bg.set({ left: 0, top: W });
        }
    }

    // Faire pivoter tous les objets dessinés par-dessus
    fabricCanvas.getObjects().forEach(obj => {
        const oldLeft = obj.left;
        const oldTop = obj.top;
        
        // Formule mathématique de rotation 90° dans un repère inversé
        obj.set({
            left: currentHeight - oldTop,
            top: oldLeft,
            angle: (obj.angle || 0) + 90
        });
        obj.setCoords();
    });

    fabricCanvas.renderAll();
    saveState();
}

// ==========================================
// ↗️ CRÉATION DE LA FLÈCHE
// ==========================================
function addArrow(color, strokeWidth, styleType) {
    const w = fabricCanvas.width;
    const h = fabricCanvas.height;
    
    let dashArray = null;
    if (styleType === 'dashed') dashArray = [strokeWidth * 3, strokeWidth * 2];
    if (styleType === 'dotted') dashArray = [strokeWidth, strokeWidth * 2];

    const line = new fabric.Line([w/2 - 50, h/2, w/2 + 50, h/2], {
        stroke: color, 
        strokeWidth: strokeWidth, 
        strokeDashArray: dashArray,
        originX: 'center', originY: 'center'
    });

    const headFill = styleType === 'open' ? 'transparent' : color;
    const headStroke = styleType === 'open' ? color : 'transparent';
    const headStrokeW = styleType === 'open' ? strokeWidth : 0;

    const head = new fabric.Triangle({
        left: w/2 + 50, top: h/2, angle: 90,
        width: strokeWidth * 4, height: strokeWidth * 4, 
        fill: headFill, stroke: headStroke, strokeWidth: headStrokeW,
        originX: 'center', originY: 'center'
    });

    const arrow = new fabric.Group([line, head], {
        left: w/2, top: h/2,
        originX: 'center', originY: 'center',
        borderColor: '#0369a1', cornerColor: '#0369a1', transparentCorners: false
    });

    fabricCanvas.add(arrow);
    fabricCanvas.setActiveObject(arrow);
}

// ==========================================
// ⏪ SYSTÈME D'HISTORIQUE (UNDO / REDO)
// ==========================================
function _initHistoryListeners() {
    fabricCanvas.on('object:added', () => saveState());
    fabricCanvas.on('object:modified', () => saveState());
    fabricCanvas.on('path:created', () => saveState());
}

function saveState() {
    if (isStateSaving) return;
    const jsonState = JSON.stringify(fabricCanvas.toJSON());
    if (history.length > 0 && history[history.length - 1] === jsonState) return;
    history.push(jsonState);
    redoStack = []; 
}

function undo() {
    if (history.length <= 1) return; 
    isStateSaving = true;
    const currentState = history.pop();
    redoStack.push(currentState); 
    fabricCanvas.loadFromJSON(history[history.length - 1], () => {
        fabricCanvas.renderAll();
        isStateSaving = false;
    });
}

function redo() {
    if (redoStack.length === 0) return;
    isStateSaving = true;
    const nextState = redoStack.pop();
    history.push(nextState); 
    fabricCanvas.loadFromJSON(nextState, () => {
        fabricCanvas.renderAll();
        isStateSaving = false;
    });
}