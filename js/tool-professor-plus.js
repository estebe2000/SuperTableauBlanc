import { makeStreamingRequest, formatMarkdown } from './api.js';
import { appConfig, DEFAULT_SYSTEM_PROMPTS } from './config.js';
import { checkRGPD } from './rgpd-guard.js';
import { downloadOdt } from './odt-export.js';

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

    // RGPD & Sources elements
    const inputText = document.getElementById('pp-input-text');
    const rgpdAlertBox = document.getElementById('pp-rgpd-alert-box');
    const rgpdAlertList = document.getElementById('pp-rgpd-alert-list');
    
    // Buttons & Outputs
    const generateBtn = document.getElementById('pp-generate-btn');
    const outputEl = document.getElementById('pp-output');
    const copyBtn = document.getElementById('pp-copy-btn');
    const exportOdtBtn = document.getElementById('pp-export-odt-btn');
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

    // Descriptions des 20 modules
    const MODULE_DESCRIPTIONS = {
        'conception-cua': "🎓 Concevez une séance complète, structurée en enseignement explicite (Rosenshine) et différenciée selon les 3 piliers CUA.",
        'differencier': "🔀 Générez 3 versions strictement différenciées d'une consigne : Soutien (étayé), Standard, Approfondissement (complexité réflexive).",
        'analyse-cua': "🔍 Évaluez une fiche ou activité existante selon les 9 directives CUA (CAST 2.2/3.0) et obtenez 3 pistes d'adaptation prioritaires.",
        'expliciter': "💡 Dévoilez les implicites d'une consigne : séparez ce que l'élève doit FAIRE matériellement de ce qu'il doit APPRENDRE.",
        'qcm': "🧪 Rédigez un QCM équitable conforme aux 20 règles de Leclercq/Castaigne avec feedback formatif explicatif par proposition.",
        'planification-m2pa': "📐 Planifiez l'accessibilité de votre séance sur 3 niveaux : Universel (socle commun), Ciblé et Intensif.",
        'falc': "✍️ Adaptez votre texte selon les normes européennes du Facile à Lire et à Comprendre (Inclusion Europe) : phrases courtes, mots simples, zéro passif.",
        'aide-lecture': "📚 Extrayez le vocabulaire clé de niveau 2 (mots transversaux de l'écrit) et générez un résumé guidé paragraphe par paragraphe.",
        'allophone': "🌍 Adaptez une activité pour un élève allophone (EANA / CECRL) : consignes visuelles, imagier contextuel et amorces de phrases.",
        'tsa': "🧩 Aménagez la séance pour un élève avec autisme (TSA) : repères temporels explicites, consignes littérales et allègement sensoriel.",
        'surdite': "🧏 Adaptez le support pour un élève sourd ou malentendant : priorité au canal visuel (schémas, LSF/LPC, vidéos sous-titrées).",
        'deficience-visuelle': "👁️ Adaptez pour la basse vision : description textuelle des figures, linéarisation pour lecteur d'écran et typographie contrastée.",
        'handicap-moteur': "✍️ Neutralisez le coût graphique pour la dyspraxie (TDC) : formats cochants (QCM, textes à trous) et supports pré-remplis.",
        'maths-dyscalculie': "🔢 Rendez une notion de maths accessible : triple code de Dehaene (visuel, verbal, symbolique) et verbalisation systématique.",
        'dyslexie': "📖 Allégez le coût de déchiffrage : segmentation syllabique, aération visuelle renforcée et guidage phonologique sans baisser l'exigence.",
        'haut-potentiel': "⚡ Enrichissez l'activité pour un élève à Haut Potentiel (EHP - Renzulli) : complexité conceptuelle et recherche ouverte sans double ration.",
        'accompagnement': "🤝 Générez une fiche de stratégies comportementales selon la grille des 4 champs de besoins de Barry (cognitif, langagier, affectif, social).",
        'caa': "🖼️ Traduisez une consigne en une bande-phrase de pictogrammes ARASAAC selon le code couleur de la Clé de Fitzgerald.",
        'tableau-communication': "💬 Construisez une grille de communication thématique de 12 à 20 cases classées par fonction grammaticale pour une situation donnée.",
        'sequentiel': "📋 Décomposez une routine ou consigne complexe en 4 à 8 étapes chronologiques simples et illustrées (méthode TEACCH).",
        'scenario-social': "📖 Rédigez un scénario social bienveillant (méthode Carol Gray) avec au moins 2 phrases descriptives pour 1 directive."
    };

    // Tab filter for module intentions
    intentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            intentTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const family = tab.getAttribute('data-family');
            
            // Show only options in matching optgroup or select first option
            const optgroups = moduleSelect.querySelectorAll('optgroup');
            optgroups.forEach(og => {
                const grpFamily = og.getAttribute('data-family-group');
                if (grpFamily === family) {
                    og.style.display = '';
                    // Select first option in this group
                    const firstOpt = og.querySelector('option');
                    if (firstOpt) {
                        moduleSelect.value = firstOpt.value;
                        updateModuleDesc(firstOpt.value);
                    }
                } else {
                    og.style.display = 'none';
                }
            });
        });
    });

    moduleSelect?.addEventListener('change', (e) => {
        updateModuleDesc(e.target.value);
    });

    function updateModuleDesc(modId) {
        if (moduleDescBox) {
            moduleDescBox.textContent = MODULE_DESCRIPTIONS[modId] || "Sélectionnez vos options pour générer l'adaptation.";
        }
    }

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
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        recordStatus.textContent = "Transcription vocale...";
                        // Transcribe
                        try {
                            const reader = new FileReader();
                            reader.readAsDataURL(audioBlob);
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

    // GENERATION HANDLER
    generateBtn?.addEventListener('click', async () => {
        const selectedModule = moduleSelect?.value || 'conception-cua';
        const cycle = cycleSelect?.options[cycleSelect.selectedIndex]?.text || '';
        const discipline = disciplineSelect?.value || '';
        const theme = themeInput?.value || '';
        const duration = document.getElementById('pp-duration')?.options[document.getElementById('pp-duration')?.selectedIndex]?.text || '55 minutes';
        const nbSeances = document.getElementById('pp-nb-seances')?.options[document.getElementById('pp-nb-seances')?.selectedIndex]?.text || '1 séance autonome';
        
        const selectedComps = [];
        document.querySelectorAll('#pp-competence-container input:checked').forEach(cb => {
            selectedComps.push(cb.value);
        });

        const rawText = inputText?.value || '';
        const combinedContext = [rawText, extractedDocText].filter(Boolean).join("\n\n");

        // Assemble specialized prompt
        const studioPrompts = DEFAULT_SYSTEM_PROMPTS.studioModules || {};
        const systemPrompt = studioPrompts[selectedModule] || DEFAULT_SYSTEM_PROMPTS.professorPlus;

        const userPrompt = `
[CADRAGE PÉDAGOGIQUE] :
- Niveau / Cycle : ${cycle || 'Non spécifié'}
- Discipline / UE : ${discipline || 'Générale'}
- Thème / Titre de la séance : ${theme || 'Séance pédagogique inclusive'}
- Durée prévue par séance : ${duration}
- Format de la séquence : ${nbSeances}
- Compétence(s) visée(s) : ${selectedComps.join(', ') || 'Acquisition et maîtrise des savoirs fondamentaux'}

${combinedContext ? `[DOCUMENTS SOURCES & DONNÉES D'APPUI] :\n${combinedContext}\n` : ''}

[EXIGENCE DE PRODUCTION DE CONTENU COMPLET] :
Ne te limite pas à un simple plan ou à des conseils généraux. Rédige l'INTÉGRALITÉ du CONTENU PÉDAGOGIQUE DIRECTEMENT EXPLOITABLE pour la classe :
1. Titre clair et Objectivation (Pourquoi apprend-on cela ?).
2. Déroulé minuté complet (sur ${duration}) avec les étapes d'enseignement explicite (Modelage, Pratique guidée, Pratique autonome).
3. Le Savoir / Cours intégralement rédigé avec définitions et repères clés.
4. Les Activités & Exercices complets prêts à être projetés ou distribués aux élèves.
5. La Différenciation CUA effective (variantes Soutien / Standard / Approfondissement).
6. Un Schéma conceptuel Mermaid (\`\`\`mermaid ... \`\`\`) pour ancrer visuellement les notions.
7. L'Évaluation formative avec corrigé explicatif.

Réponds en Markdown soigné, avec une typographie aérée et structurée.`;

        // UI Loading State
        generateBtn.disabled = true;
        generateBtn.textContent = "⏳ Génération du contenu pédagogique en cours...";
        outputEl.innerHTML = `<div class="loading-state" style="text-align:center; padding: 40px;"><div class="spinner"></div><p style="color:var(--accent1); margin-top:12px;">Élaboration du cours et des activités avec le modèle souverain...</p></div>`;
        generatedMarkdown = "";

        try {
            await makeStreamingRequest(userPrompt, {
                tool: 'professor',
                systemPrompt: systemPrompt
            }, (chunk) => {
                generatedMarkdown += chunk;
                outputEl.innerHTML = formatMarkdown(generatedMarkdown);
            });

            window.showToast("Adaptation pédagogique générée avec succès ! ✨");
            if (creditFooter) {
                creditFooter.textContent = `Module actif : ${moduleSelect?.options[moduleSelect.selectedIndex]?.text} · Conforme CUA & Données Souveraines.`;
            }
        } catch (err) {
            outputEl.innerHTML = `<div class="error-msg" style="color:#dc2626; padding: 20px;">❌ Erreur lors de la génération : ${err.message}</div>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = "✨ Générer l'Adaptation Pédagogique";
        }
    });

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

    // EXPORT ODT
    exportOdtBtn?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu à exporter.");
            return;
        }
        const title = themeInput?.value || moduleSelect?.value || "Seance_Pedagogique";
        downloadOdt(title, generatedMarkdown);
        window.showToast("Document .ODT accessible téléchargé ! 📄");
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
        window.showToast("Pack .STB exporté avec succès ! 📦");
    });

    // EXPORT TO HAPI
    exportHapiBtn?.addEventListener('click', () => {
        if (!generatedMarkdown) {
            window.showToast("Générez d'abord un contenu pour HAPI.");
            return;
        }
        sessionStorage.setItem('hapi_source_content', generatedMarkdown);
        const hapiTab = document.querySelector('.tab-link[data-tab="hapi"]');
        if (hapiTab) {
            hapiTab.click();
            window.showToast("Contenu transmis à HAPI ! 🐝");
        }
    });
}

// Extraction Helpers
async function extractPdfText(file) {
    if (!window.pdfjsLib) return "PDF parser non disponible.";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n";
    }
    return text;
}

async function extractDocxText(file) {
    if (!window.mammoth) return "DOCX parser non disponible.";
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

// Disciplines & Programmes Loaders
export async function fetchDisciplines(cycle, filiere = null) {
    const DISCIPLINES_PAR_CYCLE = {
        cycle1: ['Maternelle'],
        cycle2: ['Toutes disciplines'],
        cycle3: ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'Sciences et technologie', 'EMC', 'Arts Plastiques', 'Éducation Musicale', 'EPS', 'Histoire des Arts'],
        cycle4: ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'Technologie', 'EMC', 'Arts Plastiques', 'Éducation Musicale', 'EPS'],
        'lycee-gt': [
            'Français', 'Mathématiques', 'Mathématiques Seconde', 'Mathématiques 1ère Ens. Scientifique', 'Mathématiques 1ère Tech',
            'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'EMC', 'EPS', 
            'Anglais', 'Espagnol', 'Allemand', 'Italien', 'Latin', 'Grec ancien',
            'Philosophie', 'SES', 'NSI', 'SNT', 'Géopolitique et Sciences Politiques',
            'Histoire des Arts', 'Arts Plastiques', 'Arts Appliqués et Cultures Artistiques', 
            'Éducation Musicale', 'Théâtre', 'Cinéma-Audiovisuel',
            'SI', 'Biologie-Écologie', 'Biotechnologies', 'STI2D', 'ST2S', 'STMG'
        ],
        'lycee-pro': [
            'Français', 'Mathématiques', 'Histoire-Géographie', 'Anglais', 'Espagnol', 'EMC', 'EPS',
            'Physique-Chimie', 'PSE', 'Économie-Gestion', 'STMG',
            'Arts Plastiques', 'Arts Appliqués et Cultures Artistiques',
            'Bac Pro ASSP', 'Bac Pro AEPA', 'Bac Pro AGORA', 'Bac Pro CIEL', 'Bac Pro MELEC', 'Bac Pro MCV', 'Bac Pro Cuisine', 'Bac Pro CSR',
            'CAP AEPE', 'CAP Cuisine', 'CAP Électricien', 'CAP Coiffure'
        ],
        'post-bac': {
            'but-tc': ['Marketing', 'Vente', 'Communication commerciale', 'Économie', 'Droit des affaires', 'Anglais des affaires'],
            'licence-anglais': ['Langue et Grammaire', 'Littérature', 'Civilisation', 'Traduction (Thème/Version)', 'Linguistique', 'Phonétique']
        }
    };

    if (cycle === 'post-bac' && filiere) {
        return DISCIPLINES_PAR_CYCLE[cycle][filiere] || [];
    }
    return DISCIPLINES_PAR_CYCLE[cycle] || [];
}

function populateDisciplines(disciplines) {
    const disciplineSelect = document.getElementById('pp-discipline');
    if (!disciplineSelect) return;
    disciplineSelect.innerHTML = '<option value="">— Choisir —</option>';
    disciplines.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        disciplineSelect.appendChild(opt);
    });
}

export async function loadProgramme(cycle, discipline, filiere = null) {
    const disciplineMappings = {
        'EMC': 'education-morale-et-civique',
        'EPS': 'education-physique-et-sportive',
        'SVT': 'sciences-de-la-vie-et-de-la-terre',
        'SES': 'sciences-economiques-et-sociales',
        'NSI': 'numerique-et-sciences-informatiques',
        'SNT': 'snt-sciences-numeriques-et-technologie',
        'PSE': 'pse-prevention-sante-environnement',
        'Sciences et technologie': 'sciences-et-technologie',
        'Histoire des Arts': 'histoire-des-arts',
        'Arts Appliqués et Cultures Artistiques': 'arts-appliques-et-cultures-artistiques',
        'Géopolitique et Sciences Politiques': 'geopolitique-et-sciences-politiques',
        'Mathématiques 1ère Ens. Scientifique': 'mathematiques-premiere-enseignement-scientifique',
        'Mathématiques 1ère Tech': 'mathematiques-premiere-technologique',
        'Mathématiques Seconde': 'mathematiques-seconde',
        'SI': 'sciences-de-l-ingenieur',
        'STI2D': 'sciences-et-technologies-de-l-industrie',
        'ST2S': 'sciences-et-technologies-de-la-sante',
        'STMG': 'sciences-et-technologies-du-management',
        'Bac Pro MCV': 'bac-pro-mcv-commerce-et-vente',
        'Bac Pro CSR': 'bac-pro-csr-restauration',
        'Toutes disciplines': ''
    };

    const mappedDiscipline = disciplineMappings[discipline] || discipline;
    let filename = "";
    let subDir = "";
    
    if (cycle === 'cycle1') filename = 'cycle1-maternelle.json';
    else if (cycle === 'cycle2') filename = 'cycle2.json';
    else if (cycle === 'post-bac' && filiere) {
        subDir = filiere + "/";
        const discSlug = mappedDiscipline.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        filename = `${filiere}-${discSlug}.json`;
    } else {
        const discSlug = mappedDiscipline.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        filename = `${cycle}-${discSlug}.json`;
    }

    const path = `/programmes/${subDir}${filename}`;
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Programme introuvable.`);
    }
    return await response.json();
}

function populateCompetences(programme) {
    const container = document.getElementById('pp-competence-container');
    if (!container) return;
    container.innerHTML = '';
    
    let items = [];
    if (programme.domaines && !Array.isArray(programme.domaines)) {
        Object.values(programme.domaines).forEach(domaine => {
            if (domaine.sous_domaines) {
                Object.values(domaine.sous_domaines).forEach(sd => {
                    if (sd.attendus) items.push(...sd.attendus);
                    if (sd.competences) items.push(...sd.competences);
                });
            }
            if (domaine.competences) items.push(...domaine.competences);
            if (domaine.attendus) items.push(...domaine.attendus);
        });
    } else if (Array.isArray(programme.domaines)) {
        programme.domaines.forEach(domaine => {
            if (domaine.competences) items.push(...domaine.competences);
            if (domaine.attendus) items.push(...domaine.attendus);
        });
    } else if (Array.isArray(programme.competences)) {
        items = programme.competences;
    }

    items.forEach(comp => {
        const label = typeof comp === 'string' ? comp : (comp.intitule || comp.label || comp.nom || JSON.stringify(comp));
        const id = `comp-${Math.random().toString(36).substr(2, 9)}`;
        const item = document.createElement('div');
        item.className = 'competence-item';
        item.style.fontSize = '0.85rem';
        item.style.marginBottom = '4px';
        item.innerHTML = `<input type="checkbox" id="${id}" value="${label}"> <label for="${id}">${label}</label>`;
        container.appendChild(item);
    });

    if (container.innerHTML === '') {
        container.innerHTML = '<p class="placeholder-text" style="font-size:0.85rem;">Aucune compétence répertoriée pour cette discipline.</p>';
    }
}
