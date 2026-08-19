import { makeStreamingRequest, formatMarkdown } from './api.js';
import { appConfig, DEFAULT_SYSTEM_PROMPTS } from './config.js';
import { checkRGPD } from './rgpd-guard.js';
import { exportODT, exportWord, exportPDF, exportMarkdown, exportLatex } from './export-suite.js';
import { searchPictos, pictoUrl, ARASAAC_CREDIT } from './arasaac.js';

export function initProfessorPlus() {
    const cycleSelect = document.getElementById('pp-cycle');
    const disciplineSelect = document.getElementById('pp-discipline');
    const filiereField = document.getElementById('pp-filiere-field');
    const filiereSelect = document.getElementById('pp-filiere');
    const competenceContainer = document.getElementById('pp-competence-container');
    const themeInput = document.getElementById('pp-theme');
    
    // Module selector & tabs
    const moduleSelect = document.getElementById('pp-selected-module');
    const moduleDescBox = document.getElementById('pp-module-description-box');
    const intentTabs = document.querySelectorAll('.studio-tab-btn');
    const dynamicModuleTitle = document.getElementById('pp-dynamic-module-title');
    const dynamicFieldsContainer = document.getElementById('pp-dynamic-fields-container');

    // RGPD & Sources elements
    const inputText = document.getElementById('pp-input-text');
    const rgpdAlertBox = document.getElementById('pp-rgpd-alert-box');
    const rgpdAlertList = document.getElementById('pp-rgpd-alert-list');
    
    // Buttons & Outputs
    const generateBtn = document.getElementById('pp-generate-btn');
    const outputEl = document.getElementById('pp-output');
    const copyBtn = document.getElementById('pp-copy-btn');
    const exportStbBtn = document.getElementById('pp-export-stb-btn');
    const exportHapiBtn = document.getElementById('pp-export-hapi-btn');
    const creditFooter = document.getElementById('pp-credit-footer');

    // Doc / Audio elements
    const fileInputDoc = document.getElementById('pp-file-input-doc');
    const dropZoneDoc = document.getElementById('pp-drop-zone-doc');
    const docStatus = document.getElementById('pp-doc-status');
    const recordBtn = document.getElementById('pp-record-btn');
    const recordStatus = document.getElementById('pp-record-status');

    let extractedDocText = "";
    let mediaRecorder = null;
    let audioChunks = [];
    let generatedMarkdown = "";

    const modulesList = DEFAULT_SYSTEM_PROMPTS.studioModulesList || [];

    // Populate module selector according to active family tab
    function populateModuleSelector(activeFamily = 'concevoir') {
        if (!moduleSelect) return;
        moduleSelect.innerHTML = '';

        const filtered = activeFamily ? modulesList.filter(m => m.family === activeFamily) : modulesList;

        filtered.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.icon} ${m.name} — ${m.desc}`;
            moduleSelect.appendChild(opt);
        });

        if (filtered.length > 0) {
            moduleSelect.value = filtered[0].id;
            onModuleChange(filtered[0].id);
        }
    }

    // Handle Module Change & Dynamic Form Generation
    function onModuleChange(modId) {
        const mod = modulesList.find(m => m.id === modId);
        if (!mod) return;

        if (moduleDescBox) {
            moduleDescBox.innerHTML = `<strong>${mod.icon} ${mod.name}</strong> : ${mod.desc}`;
        }
        if (dynamicModuleTitle) {
            dynamicModuleTitle.textContent = `${mod.icon} ${mod.name}`;
        }

        // Render dynamic custom fields
        if (dynamicFieldsContainer) {
            dynamicFieldsContainer.innerHTML = '';

            // If Allophone, add an example loader button
            if (mod.id === 'allophone') {
                const exampleRow = document.createElement('div');
                exampleRow.style.cssText = 'grid-column: 1 / -1; display:flex; justify-content:flex-end; margin-bottom: 4px;';
                exampleRow.innerHTML = `<button type="button" id="pp-fill-example-btn" class="btn btn-outline" style="font-size:0.8rem; padding:4px 12px; border-radius:6px; cursor:pointer; color:var(--accent1); border-color:var(--accent1);">💡 Remplir avec l'exemple (Géographie CE2 Allophone)</button>`;
                dynamicFieldsContainer.appendChild(exampleRow);

                setTimeout(() => {
                    document.getElementById('pp-fill-example-btn')?.addEventListener('click', () => {
                        const desc = document.getElementById('pp-field-activityDescription');
                        if (desc) desc.value = "Séance de géographie sur les paysages de France. Les élèves/étudiants doivent lire un texte descriptif, identifier les éléments du paysage sur une carte et rédiger 3 phrases sur le paysage de leur choix.";
                        if (cycleSelect) {
                            cycleSelect.value = 'cycle2';
                            cycleSelect.dispatchEvent(new Event('change'));
                        }
                        if (themeInput) themeInput.value = "Les paysages de France";
                        const nf = document.getElementById('pp-field-niveau_francais');
                        if (nf) nf.value = 'Quelques mots';
                        const lm = document.getElementById('pp-field-langue_maternelle');
                        if (lm) lm.value = 'Arabe';
                    });
                }, 50);
            }

            if (mod.fields && mod.fields.length > 0) {
                mod.fields.forEach(field => {
                    const fieldWrapper = document.createElement('div');
                    fieldWrapper.className = 'field';
                    if (field.type === 'textarea' || field.type === 'checkboxes') {
                        fieldWrapper.style.gridColumn = '1 / -1';
                    }

                    const label = document.createElement('label');
                    label.className = 'section-label';
                    label.textContent = field.label;
                    fieldWrapper.appendChild(label);

                    if (field.type === 'select') {
                        const sel = document.createElement('select');
                        sel.className = 'studio-select';
                        sel.id = `pp-field-${field.id}`;
                        (field.options || []).forEach(opt => {
                            const o = document.createElement('option');
                            o.value = opt.value;
                            o.textContent = opt.label;
                            sel.appendChild(o);
                        });
                        fieldWrapper.appendChild(sel);

                        // If select has __other__ option, add custom text input
                        if (field.id === 'langue_maternelle' || (field.options || []).some(o => o.value === '__other__')) {
                            const otherInput = document.createElement('input');
                            otherInput.type = 'text';
                            otherInput.className = 'search-input';
                            otherInput.id = `pp-field-${field.id}-other`;
                            otherInput.placeholder = "Saisissez la langue maternelle…";
                            otherInput.style.cssText = 'display:none; height:42px; padding-left:12px; border-radius:8px; margin-top:6px; width:100%;';
                            fieldWrapper.appendChild(otherInput);

                            sel.addEventListener('change', () => {
                                if (sel.value === '__other__') {
                                    otherInput.style.display = 'block';
                                    otherInput.focus();
                                } else {
                                    otherInput.style.display = 'none';
                                }
                            });
                        }
                    } else if (field.type === 'checkboxes') {
                        const checkGrid = document.createElement('div');
                        checkGrid.id = `pp-field-${field.id}`;
                        checkGrid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-top: 4px;';
                        (field.options || []).forEach(opt => {
                            const lbl = document.createElement('label');
                            lbl.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--bg-input, #ffffff); border:1px solid var(--border-color, #e2e8f0); border-radius:8px; cursor:pointer; font-size:0.88rem;';
                            const cb = document.createElement('input');
                            cb.type = 'checkbox';
                            cb.value = opt.value;
                            cb.checked = !!opt.checked;
                            cb.name = `pp-cb-${field.id}`;
                            cb.style.cssText = 'width:18px; height:18px; cursor:pointer; accent-color:var(--accent1);';
                            lbl.appendChild(cb);
                            lbl.appendChild(document.createTextNode(opt.label));
                            checkGrid.appendChild(lbl);
                        });
                        fieldWrapper.appendChild(checkGrid);
                    } else if (field.type === 'textarea') {
                        const ta = document.createElement('textarea');
                        ta.className = 'search-input';
                        ta.id = `pp-field-${field.id}`;
                        ta.rows = 3;
                        ta.placeholder = field.placeholder || '';
                        ta.style.borderRadius = '8px';
                        ta.style.width = '100%';
                        fieldWrapper.appendChild(ta);
                    } else {
                        const inp = document.createElement('input');
                        inp.type = 'text';
                        inp.className = 'search-input';
                        inp.id = `pp-field-${field.id}`;
                        inp.placeholder = field.placeholder || '';
                        inp.style.height = '42px';
                        inp.style.paddingLeft = '12px';
                        inp.style.borderRadius = '8px';
                        fieldWrapper.appendChild(inp);
                    }

                    dynamicFieldsContainer.appendChild(fieldWrapper);
                });
            } else {
                dynamicFieldsContainer.innerHTML = '<p class="placeholder-text" style="font-size:0.85rem; margin:4px 0;">Ce module utilise les paramètres généraux et les documents sources fournis ci-dessous.</p>';
            }
        }
    }

    // Tab switcher for module families
    intentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            intentTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const family = tab.getAttribute('data-family');
            populateModuleSelector(family);
        });
    });

    moduleSelect?.addEventListener('change', (e) => {
        onModuleChange(e.target.value);
    });

    // Initial population
    populateModuleSelector('concevoir');

    // Source Tabs Logic (Text / Doc / Audio)
    const sourceTabs = document.querySelectorAll('.pp-source-tab');
    const sourceContents = document.querySelectorAll('.pp-source-content');
    
    sourceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const src = tab.getAttribute('data-source');
            sourceTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            sourceContents.forEach(content => {
                content.style.display = (content.id === `pp-source-${src}`) ? 'block' : 'none';
            });
        });
    });

    // Real-time RGPD Guard
    inputText?.addEventListener('input', () => {
        const text = inputText.value;
        const alerts = checkRGPD(text);
        if (alerts.length > 0) {
            rgpdAlertBox.style.display = 'block';
            rgpdAlertList.innerHTML = '';
            alerts.forEach(a => {
                const li = document.createElement('li');
                li.textContent = a.message;
                rgpdAlertList.appendChild(li);
            });
        } else {
            rgpdAlertBox.style.display = 'none';
        }
    });

    // File Upload handling
    if (dropZoneDoc) {
        dropZoneDoc.addEventListener('click', () => fileInputDoc.click());
        fileInputDoc.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                docStatus.style.display = 'block';
                docStatus.textContent = `Chargement de ${file.name}...`;
                try {
                    if (file.type === 'application/pdf') {
                        extractedDocText = await extractPdfText(file);
                    } else if (file.name.endsWith('.docx')) {
                        extractedDocText = await extractDocxText(file);
                    } else {
                        throw new Error("Format non supporté (PDF ou DOCX uniquement).");
                    }
                    docStatus.textContent = `✅ ${file.name} chargé (${extractedDocText.length} caractères)`;
                    docStatus.style.color = '#16a34a';
                } catch (err) {
                    docStatus.textContent = `❌ Erreur : ${err.message}`;
                    docStatus.style.color = '#dc2626';
                }
            }
        });
    }

    // Microphone Dictation Handling
    if (recordBtn) {
        recordBtn.addEventListener('click', async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                recordBtn.classList.remove('recording');
                recordBtn.textContent = '🎤';
                recordStatus.textContent = "Traitement audio en cours...";
            } else {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                    mediaRecorder.onstop = async () => {
                        recordStatus.textContent = "Transcription vocale...";
                        try {
                            const reader = new FileReader();
                            reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
                            reader.onloadend = async () => {
                                const base64 = reader.result.split(',')[1];
                                const prompt = "Transcris fidèlement et mot-à-mot cet enregistrement audio :";
                                let transcription = "";
                                await makeStreamingRequest(prompt, { tool: 'voice', images: [base64] }, (chunk) => {
                                    transcription += chunk;
                                });
                                if (inputText) {
                                    inputText.value += (inputText.value ? "\n\n" : "") + transcription;
                                    inputText.dispatchEvent(new Event('input'));
                                }
                                recordStatus.textContent = "✅ Dictée ajoutée au texte source !";
                            };
                        } catch (err) {
                            recordStatus.textContent = `❌ Erreur transcription : ${err.message}`;
                        }
                    };
                    mediaRecorder.start();
                    recordBtn.classList.add('recording');
                    recordBtn.textContent = '⏹️';
                    recordStatus.textContent = "Enregistrement en cours... Parlez maintenant.";
                } catch (err) {
                    recordStatus.textContent = "❌ Accès micro refusé.";
                }
            }
        });
    }

    // Cycle & Discipline change
    cycleSelect?.addEventListener('change', async (e) => {
        const cycle = e.target.value;
        if (cycle === 'post-bac') {
            if (filiereField) filiereField.style.display = 'block';
            disciplineSelect.disabled = false;
            populateDisciplines(await fetchDisciplines(cycle, filiereSelect?.value || 'but-tc'));
        } else if (cycle) {
            if (filiereField) filiereField.style.display = 'none';
            disciplineSelect.disabled = false;
            populateDisciplines(await fetchDisciplines(cycle));
        } else {
            if (filiereField) filiereField.style.display = 'none';
            disciplineSelect.disabled = true;
            disciplineSelect.innerHTML = '<option value="">— Choisir le niveau —</option>';
        }
    });

    filiereSelect?.addEventListener('change', async (e) => {
        const filiere = e.target.value;
        if (filiere) {
            populateDisciplines(await fetchDisciplines('post-bac', filiere));
        }
    });

    disciplineSelect?.addEventListener('change', async (e) => {
        const disc = e.target.value;
        const cycle = cycleSelect.value;
        const filiere = filiereSelect?.value;
        if (disc && cycle) {
            try {
                const prog = await loadProgramme(cycle, disc, filiere);
                populateCompetences(prog);
            } catch (err) {
                console.warn(err);
                if (competenceContainer) {
                    competenceContainer.innerHTML = '<p class="placeholder-text" style="font-size:0.85rem;">Programme standard prêt.</p>';
                }
            }
        }
    });

    // Auto-load Cycle 4 Mathématiques initially
    (async () => {
        if (cycleSelect && disciplineSelect) {
            cycleSelect.value = 'cycle4';
            disciplineSelect.disabled = false;
            populateDisciplines(await fetchDisciplines('cycle4'));
            disciplineSelect.value = 'mathematiques';
            const prog = await loadProgramme('cycle4', 'mathematiques');
            populateCompetences(prog);
        }
    })();

    // GENERATION HANDLER
    generateBtn?.addEventListener('click', async () => {
        const selectedModule = moduleSelect?.value || 'conception-cua';
        const modObj = modulesList.find(m => m.id === selectedModule);
        const cycle = cycleSelect?.options[cycleSelect.selectedIndex]?.text || '';
        const discipline = disciplineSelect?.value || '';
        const theme = themeInput?.value || '';
        const duration = document.getElementById('pp-duration')?.options[document.getElementById('pp-duration')?.selectedIndex]?.text || '55 minutes';
        const nbSeances = document.getElementById('pp-nb-seances')?.options[document.getElementById('pp-nb-seances')?.selectedIndex]?.text || '1 séance autonome';
        
        const selectedComps = [];
        document.querySelectorAll('#pp-competence-container input:checked').forEach(cb => {
            selectedComps.push(cb.value);
        });

        // Collect dynamic fields
        const dynamicValues = [];
        if (modObj && modObj.fields) {
            modObj.fields.forEach(f => {
                if (f.type === 'checkboxes') {
                    const checked = [];
                    document.querySelectorAll(`input[name="pp-cb-${f.id}"]:checked`).forEach(cb => {
                        checked.push(cb.value);
                    });
                    if (checked.length > 0) {
                        dynamicValues.push(`- ${f.label} : ${checked.join(', ')}`);
                    }
                } else if (f.type === 'select') {
                    const el = document.getElementById(`pp-field-${f.id}`);
                    if (el) {
                        let val = el.options[el.selectedIndex]?.text || el.value;
                        if (el.value === '__other__') {
                            const otherInp = document.getElementById(`pp-field-${f.id}-other`);
                            if (otherInp && otherInp.value.trim()) {
                                val = otherInp.value.trim();
                            }
                        }
                        if (val && val !== 'Choisir…') {
                            dynamicValues.push(`- ${f.label} : ${val}`);
                        }
                    }
                } else {
                    const el = document.getElementById(`pp-field-${f.id}`);
                    if (el && el.value.trim()) {
                        dynamicValues.push(`- ${f.label} : ${el.value.trim()}`);
                    }
                }
            });
        }

        const rawText = inputText?.value || '';
        const combinedContext = [rawText, extractedDocText].filter(Boolean).join("\n\n");

        // Assemble specialized prompt
        const studioPrompts = DEFAULT_SYSTEM_PROMPTS.studioModules || {};
        const systemPrompt = studioPrompts[selectedModule] || DEFAULT_SYSTEM_PROMPTS.professorPlus;

        const userPrompt = `
[CADRAGE PÉDAGOGIQUE GÉNÉRAL] :
- Module sélectionné : ${modObj ? modObj.name : selectedModule}
- Niveau / Cycle : ${cycle || 'Non spécifié'}
- Discipline / UE : ${discipline || 'Générale'}
- Thème / Titre de la séance : ${theme || 'Séance pédagogique inclusive'}
- Durée prévue par séance : ${duration}
- Format de la séquence : ${nbSeances}
- Compétence(s) visée(s) : ${selectedComps.join(', ') || 'Acquisition et maîtrise des savoirs fondamentaux'}

${dynamicValues.length > 0 ? `[PARAMÈTRES SPÉCIFIQUES DU MODULE] :\n${dynamicValues.join('\n')}\n` : ''}
${combinedContext ? `[DOCUMENTS SOURCES & DONNÉES D'APPUI] :\n${combinedContext}\n` : ''}

[CONSIGNES DE PRODUCTION ET FORMAT DE SORTIE STRICT] :
Rédige le support de manière complète, détaillée et sans aucune ellipse (pas de « voir annexe » ni de « tableau à compléter ultérieurement »).
Organise OBLIGATOIREMENT ta réponse en deux grandes parties distinctes :

---
## 📄 PARTIE 1 : Document à remettre à l'Élève
*(Cette partie doit être immédiatement imprimable et utilisable en classe, SANS aucun méta-commentaire ni jargon d'évaluation)*
- Le Titre clair et la mise en situation concrète.
- Le Cours / Savoir intégralement rédigé avec définitions et repères visuels.
${selectedModule === 'allophone' ? '- Le Tableau de Lexique Disciplinaire Bilingue complet avec colonnes : | Mot (français) | Traduction (selon langue maternelle) | Exemple illustré |\n- Les Phrases modèles à trous et structures de phrases pour guider l\'écrit.\n- Les fiches d\'exercices adaptées au niveau CECRL.' : ''}
${selectedModule === 'differencier' ? '- Les 3 versions autonomes de la consigne (Soutien / Standard / Expert) rédigées intégralement avec critères de réussite.' : ''}
${selectedModule === 'falc' ? '- Le texte intégral réécrit en FALC (phrases courtes < 15 mots SVC, une idée par ligne, vocabulaire simple) suivi du glossaire.' : ''}
${selectedModule === 'aide-lecture' ? '- Le Lexique structuré (niveau 2 transversal et niveau 3 disciplinaire) avec définitions accessibles et exemples, suivi des résumés par paragraphe.' : ''}
${selectedModule === 'qcm' ? '- Le questionnaire complet avec amorce, choix étiquetés et rétroactions formatives bienveillantes pour chaque option.' : ''}
${selectedModule === 'conception-cua' ? '- Les fiches d\'activités et exercices différenciés complets (Soutien / Standard / Approfondissement) prêts pour les élèves.' : ''}
- Si un diagramme Mermaid est pertinent, écris-le avec des labels rigoureusement entre guillemets doubles, ex: \`\`\`mermaid\ngraph TD\n  A["Concept"] --> B["Détail (15%)"]\n\`\`\`

---
## 🧑‍🏫 PARTIE 2 : Fiche de Préparation & Notes pour l'Enseignant
- Le déroulé minuté complet (sur ${duration}) avec les étapes d'enseignement explicite (Modelage, Pratique guidée, Pratique autonome).
- Les principes et aménagements d'accessibilité mobilisés.
- Le corrigé complet et explicatif des activités.
- La synthèse des **3 gestes prioritaires à mettre en place dès demain** (un geste en une phrase, puis le signe observable pour l'alléger).`;

        // UI Loading State
        generateBtn.disabled = true;
        generateBtn.textContent = "⏳ Génération du contenu pédagogique en cours...";
        outputEl.innerHTML = `<div class="loading-state" style="text-align:center; padding: 50px 20px;"><div class="spinner"></div><p style="color:var(--accent1); margin-top:14px; font-weight:600; font-size:1.05rem;">Élaboration complète du cours et des supports de classe...</p></div>`;
        generatedMarkdown = "";

        // Scroll to output
        outputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        try {
            await makeStreamingRequest(userPrompt, {
                tool: 'professor',
                systemPrompt: systemPrompt
            }, (chunk) => {
                generatedMarkdown += chunk;
                formatMarkdown(outputEl, generatedMarkdown);
            });

            // Post-rendering diagrams & equations
            // Post-rendering diagrams & equations
            if (window.mermaid) {
                try {
                    const mermaidNodes = outputEl.querySelectorAll('.mermaid');
                    for (const node of mermaidNodes) {
                        try {
                            if (window.mermaid.parse) {
                                await window.mermaid.parse(node.textContent);
                            }
                        } catch (err) {
                            // Convert broken mermaid block to clean visual flow card
                            const cleanLines = node.textContent.split('\n').filter(l => l.trim() && !l.trim().startsWith('graph') && !l.trim().startsWith('flowchart'));
                            const steps = cleanLines.map(l => l.replace(/["\[\]\(\)]/g, '').replace(/-->/g, ' ➔ ').trim()).filter(Boolean);
                            const fallbackCard = document.createElement('div');
                            fallbackCard.className = 'flowchart-fallback-card';
                            fallbackCard.style.cssText = 'background:#f8fafc; border:1.5px solid #93c5fd; border-radius:10px; padding:14px; margin:14px 0;';
                            fallbackCard.innerHTML = `
                                <div style="font-weight:700; color:#1d4ed8; margin-bottom:8px; font-size:0.95rem;">📊 Schéma & Règle Visuelle :</div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    ${steps.map(s => `<div style="background:#ffffff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 12px; font-weight:600; color:#1e293b;">📌 ${s}</div>`).join('')}
                                </div>
                            `;
                            if (node.parentElement) {
                                node.parentElement.replaceWith(fallbackCard);
                            }
                        }
                    }
                    window.mermaid.run({ nodes: outputEl.querySelectorAll('.mermaid') });
                } catch (mErr) {
                    console.warn("Mermaid render note:", mErr);
                }
            }

            // Post-rendering: Auto-illustrate all image placeholders with real ARASAAC pictograms
            await autoIllustrateContent(outputEl);

            // Post-rendering: ARASAAC PictoLexique on bilingual lexicon table
            await renderPictoLexique(outputEl);

            window.showToast("Support pédagogique généré avec succès ! ✨");
            if (creditFooter) {
                creditFooter.textContent = `Module actif : ${modObj ? modObj.name : selectedModule} · Conforme CUA & Données Souveraines.`;
            }
        } catch (err) {
            outputEl.innerHTML = `<div class="error-msg" style="color:#dc2626; padding: 20px;">❌ Erreur lors de la génération : ${err.message}</div>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = "✨ Générer le Support Pédagogique Complet";
        }
    });

    // Helper: Auto-Illustrate all image placeholders in text nodes and table cells
    async function autoIllustrateContent(container) {
        // Collect all text nodes with placeholder patterns
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let cur;
        while (cur = walker.nextNode()) {
            if (/!\[(?:Image\s*:\s*)?([^\]]+)\]|\[(?:Image\s*:\s*|picto\s*:\s*)([^\]]+)\]/i.test(cur.nodeValue)) {
                textNodes.push(cur);
            }
        }

        for (const node of textNodes) {
            const parent = node.parentNode;
            if (!parent || parent.tagName === 'CODE' || parent.tagName === 'PRE') continue;

            const text = node.nodeValue;
            const regex = /!\[(?:Image\s*:\s*)?([^\]]+)\](?:\([^\)]*\))?|\[(?:Image\s*:\s*|picto\s*:\s*)([^\]]+)\]/gi;
            let match;
            const replacements = [];

            while ((match = regex.exec(text)) !== null) {
                let concept = match[1] || match[2] || '';
                // Extract clean keyword
                let keyword = concept;
                if (keyword.includes('«') && keyword.includes('»')) {
                    const q = keyword.match(/«\s*([^»]+)\s*»/);
                    if (q) keyword = q[1];
                } else if (keyword.includes('"')) {
                    const q = keyword.match(/"([^"]+)"/);
                    if (q) keyword = q[1];
                } else if (keyword.toLowerCase().includes('carte postale')) {
                    keyword = 'carte postale';
                } else if (keyword.toLowerCase().includes('nez') || keyword.toLowerCase().includes('visage')) {
                    keyword = 'nez';
                } else if (keyword.toLowerCase().includes('dictionnaire')) {
                    keyword = 'dictionnaire';
                } else if (keyword.toLowerCase().includes('élève')) {
                    keyword = 'élève';
                }

                const cleanKey = keyword.replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '').replace(/^(le|la|les|un|une|des|l')\s+/i, '').replace(/[\*\_]/g, '').trim();
                if (cleanKey) {
                    replacements.push({ raw: match[0], key: cleanKey });
                }
            }

            if (replacements.length > 0) {
                const span = document.createElement('span');
                span.innerHTML = text;
                for (const r of replacements) {
                    try {
                        const pictos = await searchPictos(r.key);
                        if (pictos && pictos.length > 0) {
                            const pId = pictos[0]._id || pictos[0].id;
                            const pUrl = pictoUrl(pId, { resolution: 300 });
                            const badge = `<span class="inline-arasaac-badge" style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; border:1.5px solid #93c5fd; border-radius:8px; padding:2px 8px; margin:2px 4px; vertical-align:middle;"><img src="${pUrl}" alt="${r.key}" style="width:30px; height:30px; object-fit:contain;" /><strong style="color:#1e3a8a; font-size:0.88rem;">${r.key}</strong></span>`;
                            span.innerHTML = span.innerHTML.replace(r.raw, badge);
                        } else {
                            span.innerHTML = span.innerHTML.replace(r.raw, `<span class="badge" style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px;">🖼️ ${r.key}</span>`);
                        }
                    } catch (e) {
                        span.innerHTML = span.innerHTML.replace(r.raw, `<strong>${r.key}</strong>`);
                    }
                }
                parent.replaceChild(span, node);
            }
        }
    }

    // Helper: Render PictoLexique gallery from output tables
    async function renderPictoLexique(container) {
        const tables = container.querySelectorAll('table');
        if (!tables || tables.length === 0) return;

        let galleryRendered = false;

        for (const table of tables) {
            if (galleryRendered) break; // Only attach one main PictoLexique gallery

            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
            const motIdx = headers.findIndex(h => h.includes('mot') || h.includes('terme') || h.includes('vocabulaire') || h.includes('français'));
            if (motIdx === -1) continue;

            const tradIdx = headers.findIndex(h => h.includes('traduc') || h.includes('langue') || h.includes('arabe') || h.includes('arménien') || h.includes('ukrainien') || h.includes('espagnol') || h.includes('anglais'));
            if (tradIdx === -1) continue; // Only for bilingual vocabulary table!

            const rows = table.querySelectorAll('tbody tr');
            if (rows.length === 0) continue;

            const pictoGallery = document.createElement('div');
            pictoGallery.className = 'picto-lexique-container';
            pictoGallery.style.cssText = 'margin: 20px 0; padding: 16px; background: rgba(59, 130, 246, 0.05); border: 1.5px solid rgba(59, 130, 246, 0.25); border-radius: 12px;';
            
            pictoGallery.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(0,0,0,0.08); padding-bottom:8px; flex-wrap:wrap; gap:6px;">
                    <h4 style="margin:0; font-size:1.05rem; color:var(--accent1); display:flex; align-items:center; gap:8px;">
                        🖼️ Lexique Illustré ARASAAC (Communication Augmentée)
                    </h4>
                    <span style="font-size:0.75rem; color:#64748b;">${ARASAAC_CREDIT}</span>
                </div>
                <div class="picto-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;"></div>
            `;

            const cardsGrid = pictoGallery.querySelector('.picto-cards-grid');

            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length <= motIdx) continue;

                const rawWord = cells[motIdx].textContent.trim();
                const cleanWord = rawWord.replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '').replace(/^(le|la|les|un|une|des|l')\s+/i, '').replace(/[\*\_]/g, '').trim();
                if (!cleanWord || cleanWord.length < 2) continue;

                const trad = (tradIdx !== -1 && cells[tradIdx]) ? cells[tradIdx].textContent.trim() : '';

                try {
                    const pictos = await searchPictos(cleanWord);
                    if (pictos && pictos.length > 0) {
                        const pictoId = pictos[0]._id || pictos[0].id;
                        const imgUrl = pictoUrl(pictoId, { resolution: 300 });

                        const card = document.createElement('div');
                        card.className = 'picto-card';
                        card.style.cssText = 'background:#ffffff; border:2px solid #e2e8f0; border-radius:10px; padding:10px 8px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.04); display:flex; flex-direction:column; align-items:center; gap:4px;';
                        card.innerHTML = `
                            <img src="${imgUrl}" alt="${cleanWord}" style="width:70px; height:70px; object-fit:contain; border-radius:6px;" loading="lazy" />
                            <span style="font-weight:700; font-size:0.92rem; color:#1e293b; margin-top:2px;">${cleanWord}</span>
                            ${trad ? `<span style="font-size:0.82rem; color:#0284c7; font-weight:600;">${trad}</span>` : ''}
                        `;
                        cardsGrid.appendChild(card);
                    }
                } catch (pErr) {
                    console.warn("Picto search err for word:", cleanWord, pErr);
                }
            }

            if (cardsGrid.children.length > 0) {
                table.parentNode.insertBefore(pictoGallery, table.nextSibling);
                galleryRendered = true;
            }
        }
    }

    // COPY MARKDOWN
    copyBtn?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Rien à copier pour le moment.");
            return;
        }
        navigator.clipboard.writeText(generatedMarkdown).then(() => {
            window.showToast("Contenu Markdown copié ! ✓");
        });
    });

    // Unified Export Dropdown Logic
    const exportMenuBtn = document.getElementById('pp-export-menu-btn');
    const exportDropdown = document.getElementById('pp-export-dropdown');

    exportMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (exportDropdown) {
            const isShown = exportDropdown.style.display === 'flex';
            exportDropdown.style.display = isShown ? 'none' : 'flex';
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (exportDropdown && !exportDropdown.contains(e.target) && e.target !== exportMenuBtn) {
            exportDropdown.style.display = 'none';
        }
    });

    function getExportTitle() {
        return themeInput?.value || moduleSelect?.options[moduleSelect.selectedIndex]?.text?.split('—')[0]?.trim() || "Seance_Pedagogique";
    }

    function getExportMeta() {
        return {
            cycle: cycleSelect?.options[cycleSelect.selectedIndex]?.text || '',
            discipline: disciplineSelect?.value || '',
            theme: themeInput?.value || getExportTitle()
        };
    }

    // 1. ODT Export
    document.getElementById('pp-exp-odt')?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        exportODT(getExportTitle(), outputEl.innerHTML || generatedMarkdown, getExportMeta());
        if (exportDropdown) exportDropdown.style.display = 'none';
        window.showToast("Document .ODT accessible téléchargé ! 📄");
    });

    // 2. Word Export (.doc / docx compatible)
    document.getElementById('pp-exp-word')?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        exportWord(getExportTitle(), outputEl.innerHTML || generatedMarkdown, getExportMeta());
        if (exportDropdown) exportDropdown.style.display = 'none';
        window.showToast("Document Word (.doc) téléchargé ! 📝");
    });

    // 3. PDF Export
    document.getElementById('pp-exp-pdf')?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        exportPDF(getExportTitle(), outputEl.innerHTML || generatedMarkdown, getExportMeta());
        if (exportDropdown) exportDropdown.style.display = 'none';
        window.showToast("Génération de la vue PDF en cours... 📑");
    });

    // 4. Markdown Export
    document.getElementById('pp-exp-md')?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        exportMarkdown(getExportTitle(), generatedMarkdown);
        if (exportDropdown) exportDropdown.style.display = 'none';
        window.showToast("Fichier Markdown (.md) téléchargé ! 📋");
    });

    // 5. LaTeX Export
    document.getElementById('pp-exp-latex')?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        exportLatex(getExportTitle(), generatedMarkdown);
        if (exportDropdown) exportDropdown.style.display = 'none';
        window.showToast("Document LaTeX (.tex) téléchargé ! 🔣");
    });

    // EXPORT STB (Pack de cours pour le Bureau Virtuel & Espace Élève)
    exportStbBtn?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        const title = themeInput?.value || "Seance_All_Inclusive";
        const pack = {
            format: "stb",
            version: "2.0",
            created_at: new Date().toISOString(),
            metadata: {
                title: title,
                module: moduleSelect?.value,
                cycle: cycleSelect?.value,
                discipline: disciplineSelect?.value
            },
            content: {
                markdown: generatedMarkdown
            }
        };

        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.stb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showToast("Pack de cours .STB prêt pour le Bureau Virtuel ! 📦");
    });

    // EXPORT HAPI (Générateur d'activités interactives)
    exportHapiBtn?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        window.open('https://hapi.educ-ai.fr/', '_blank');
        window.showToast("Ouverture de l'atelier HAPI... 🐝");
    });

    // Helper functions
    function populateDisciplines(disciplines) {
        if (!disciplineSelect) return;
        disciplineSelect.innerHTML = '<option value="">— Choisir la discipline —</option>';
        disciplines.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            disciplineSelect.appendChild(opt);
        });
    }

    function populateCompetences(programme) {
        if (!competenceContainer) return;
        competenceContainer.innerHTML = '';
        if (programme && programme.competences && programme.competences.length > 0) {
            programme.competences.forEach((c, i) => {
                const item = document.createElement('div');
                item.className = 'competence-item';
                item.innerHTML = `
                    <input type="checkbox" id="comp-${i}" value="${c.intitule || c}">
                    <label for="comp-${i}">${c.intitule || c}</label>
                `;
                competenceContainer.appendChild(item);
            });
        } else {
            competenceContainer.innerHTML = '<p class="placeholder-text" style="font-size:0.85rem; margin:0;">Aucune compétence spécifique trouvée.</p>';
        }
    }
}

// Helpers for reading PDF & DOCX
async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error("Bibliothèque PDF.js non disponible.");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
}

async function extractDocxText(file) {
    if (!window.mammoth) throw new Error("Bibliothèque Mammoth non disponible.");
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value;
}

async function fetchDisciplines(cycle, filiere = null) {
    if (cycle === 'post-bac') {
        if (filiere === 'but-tc') {
            return [
                { id: 'marketing', name: 'Marketing & Vente' },
                { id: 'droit-affaires', name: 'Droit des Affaires' },
                { id: 'communication', name: 'Communication Commerciale' }
            ];
        }
        return [
            { id: 'linguistique', name: 'Linguistique & Grammaire Anglaise' },
            { id: 'civilisation', name: 'Civilisation Britannique & Américaine' }
        ];
    }
    return [
        { id: 'mathematiques', name: 'Mathématiques' },
        { id: 'francais', name: 'Français' },
        { id: 'histoire-geo', name: 'Histoire-Géographie & EMC' },
        { id: 'svt', name: 'Sciences de la Vie et de la Terre (SVT)' },
        { id: 'physique-chimie', name: 'Physique-Chimie' },
        { id: 'langues-vivantes', name: 'Langues Vivantes (LVE)' }
    ];
}

async function loadProgramme(cycle, disc, filiere = null) {
    // Programmes officiels synthétisés pour l'accessibilité
    const programmes = {
        'cycle4_mathematiques': [
            { intitule: "Nombres et calculs : Nombres relatifs, fractions et puissances" },
            { intitule: "Organisation et gestion de données : Proportionnalité, statistiques et pourcentages" },
            { intitule: "Grandeurs et mesures : Périmètres, aires, volumes et conversions" },
            { intitule: "Espace et géométrie : Théorème de Pythagore, transformations et repérage" },
            { intitule: "Algorithmique et programmation : Décomposition de problèmes et boucles" }
        ],
        'cycle4_francais': [
            { intitule: "Comprendre et s'exprimer à l'oral : Argumentation et écoute active" },
            { intitule: "Lire : Lire des œuvres littéraires et documentaires variées" },
            { intitule: "Écrire : Rédiger un texte narratif, explicatif ou argumenté cohérent" },
            { intitule: "Étude de la langue : Grammaire de phrase, syntaxe et lexique" }
        ],
        'cycle3_mathematiques': [
            { intitule: "Nombres décimaux et fractions simples" },
            { intitule: "Calcul posé et mental : Les 4 opérations" },
            { intitule: "Résolution de problèmes multiplicatifs et de partage" },
            { intitule: "Géométrie plane : Propriétés des figures usuelles" }
        ]
    };

    const key = `${cycle}_${disc}`;
    return { competences: programmes[key] || [
        { intitule: "Maîtriser les connaissances fondamentales de la discipline" },
        { intitule: "Mobiliser une démarche scientifique ou réflexive" },
        { intitule: "Communiquer ses résultats à l'écrit et à l'oral" }
    ] };
}
