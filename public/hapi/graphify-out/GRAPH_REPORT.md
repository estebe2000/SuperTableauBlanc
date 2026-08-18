# Graph Report - .  (2026-05-31)

## Corpus Check
- 153 files · ~234,799 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1299 nodes · 3237 edges · 59 communities (56 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Export ODT|Export ODT]]
- [[_COMMUNITY_Vidéo interactive (H5PPDF)|Vidéo interactive (H5P/PDF)]]
- [[_COMMUNITY_Générateur H5P (sauvegarde)|Générateur H5P (sauvegarde)]]
- [[_COMMUNITY_Corpus & prompts (sauvegarde)|Corpus & prompts (sauvegarde)]]
- [[_COMMUNITY_Générateur H5P (copies)|Générateur H5P (copies)]]
- [[_COMMUNITY_Prompts d'activités|Prompts d'activités]]
- [[_COMMUNITY_Générateurs H5P modules|Générateurs H5P modules]]
- [[_COMMUNITY_Générateur H5P principal|Générateur H5P principal]]
- [[_COMMUNITY_Carte interactive|Carte interactive]]
- [[_COMMUNITY_Dictée audio|Dictée audio]]
- [[_COMMUNITY_Cartes mémoire|Cartes mémoire]]
- [[_COMMUNITY_Sélecteur d'activités|Sélecteur d'activités]]
- [[_COMMUNITY_Appariements d'images|Appariements d'images]]
- [[_COMMUNITY_Labo 3D (UI)|Labo 3D (UI)]]
- [[_COMMUNITY_Accordéon & connecteurs IA|Accordéon & connecteurs IA]]
- [[_COMMUNITY_Générateur H5P (sauv. 2)|Générateur H5P (sauv. 2)]]
- [[_COMMUNITY_Générateur H5P (copie 3)|Générateur H5P (copie 3)]]
- [[_COMMUNITY_Générateur H5P (copie)|Générateur H5P (copie)]]
- [[_COMMUNITY_Corpus-manager (sauvegarde)|Corpus-manager (sauvegarde)]]
- [[_COMMUNITY_Texte à trous|Texte à trous]]
- [[_COMMUNITY_Glisser-déposer|Glisser-déposer]]
- [[_COMMUNITY_Prompt-builder (sauv. RAG)|Prompt-builder (sauv. RAG)]]
- [[_COMMUNITY_Prompt-builder (sauv. grain)|Prompt-builder (sauv. grain)]]
- [[_COMMUNITY_Prompt-builder (copie 2)|Prompt-builder (copie 2)]]
- [[_COMMUNITY_Frise chronologique|Frise chronologique]]
- [[_COMMUNITY_VraiFaux|Vrai/Faux]]
- [[_COMMUNITY_Corpus-manager (sauv. vision)|Corpus-manager (sauv. vision)]]
- [[_COMMUNITY_Corpus-manager (sauv. vision 2)|Corpus-manager (sauv. vision 2)]]
- [[_COMMUNITY_Corpus-manager (sauv. warning)|Corpus-manager (sauv. warning)]]
- [[_COMMUNITY_Quiz Math|Quiz Math]]
- [[_COMMUNITY_VraiFaux Math|Vrai/Faux Math]]
- [[_COMMUNITY_Mots mêlés|Mots mêlés]]
- [[_COMMUNITY_Quiz QCM|Quiz QCM]]
- [[_COMMUNITY_Résumé|Résumé]]
- [[_COMMUNITY_Étiquettes à déplacer|Étiquettes à déplacer]]
- [[_COMMUNITY_Mots à repérer|Mots à repérer]]
- [[_COMMUNITY_Paragraphes (remise en ordre)|Paragraphes (remise en ordre)]]
- [[_COMMUNITY_Générateur DragText & libs|Générateur DragText & libs]]
- [[_COMMUNITY_Mots croisés|Mots croisés]]
- [[_COMMUNITY_Prévisualisation H5P|Prévisualisation H5P]]
- [[_COMMUNITY_Molécules 3D (PubChem)|Molécules 3D (PubChem)]]
- [[_COMMUNITY_Molécules 3D (PubChem) 2|Molécules 3D (PubChem) 2]]
- [[_COMMUNITY_Éditeur d'image (Fabric)|Éditeur d'image (Fabric)]]
- [[_COMMUNITY_Contexte BOEN (RAG)|Contexte BOEN (RAG)]]
- [[_COMMUNITY_Collecte données activités|Collecte données activités]]
- [[_COMMUNITY_Parseurs de fichiers|Parseurs de fichiers]]
- [[_COMMUNITY_Labo 3D (export GLB)|Labo 3D (export GLB)]]
- [[_COMMUNITY_Labo 3D (annotations)|Labo 3D (annotations)]]
- [[_COMMUNITY_Export ODT mots croisés|Export ODT mots croisés]]
- [[_COMMUNITY_Export PDF molécules|Export PDF molécules]]
- [[_COMMUNITY_Parsing réponses IA|Parsing réponses IA]]
- [[_COMMUNITY_Sélecteur de sources|Sélecteur de sources]]
- [[_COMMUNITY_Éditeur mathématique|Éditeur mathématique]]
- [[_COMMUNITY_Glisser-déposer (rendu)|Glisser-déposer (rendu)]]
- [[_COMMUNITY_Export PDF gliss.-dép. (copie)|Export PDF gliss.-dép. (copie)]]
- [[_COMMUNITY_Découverte d'activités|Découverte d'activités]]
- [[_COMMUNITY_Export PDF glisser-déposer|Export PDF glisser-déposer]]

## God Nodes (most connected - your core abstractions)
1. `logger` - 133 edges
2. `getDependencyObject()` - 103 edges
3. `getH5PLocalization()` - 63 edges
4. `creerAssistantIA_HTML()` - 41 edges
5. `callAlbertAPI()` - 38 edges
6. `corpusManager` - 31 edges
7. `echapperXML()` - 31 edges
8. `readFileContent()` - 29 edges
9. `sanitizeFileName()` - 29 edges
10. `SourceSelector` - 26 edges

## Surprising Connections (you probably didn't know these)
- `gatherData()` --calls--> `getH5PLocalization()`  [EXTRACTED]
  ia/modules/ui/timeline-ui.js → ia/modules/utils/h5p-translations.js
- `gatherData()` --calls--> `getH5PLocalization()`  [EXTRACTED]
  ia/modules/ui/image-pairing-ui.js → ia/modules/utils/h5p-translations.js
- `handleGenerateAlbert()` --calls--> `callAlbertAPI()`  [EXTRACTED]
  ia/modules/ui/truefalse-math-ui.js → ia/modules/ia/ia-connectors.js
- `gatherData()` --calls--> `getH5PLocalization()`  [EXTRACTED]
  ia/modules/ui/truefalse-math-ui.js → ia/modules/utils/h5p-translations.js
- `handleGenerateAlbertCrossword()` --calls--> `callAlbertAPI()`  [EXTRACTED]
  ia/modules/ui/crossword-ui.js → ia/modules/ia/ia-connectors.js

## Import Cycles
- None detected.

## Communities (59 total, 3 thin omitted)

### Community 0 - "Export ODT"
Cohesion: 0.11
Nodes (55): exportODT_Accordion(), exportODT_AdvancedBlanks(), exportODT_Crossword(), exportODT_DragText(), exportODT_MarkTheWords(), exportODT_Quiz(), convertLatexToStarMath(), createStarMathObject() (+47 more)

### Community 1 - "Vidéo interactive (H5P/PDF)"
Cohesion: 0.05
Nodes (51): genererH5PInteractiveVideo(), basePath, cleanTextForPdf(), cleanTextForPdf(), exportPDF_InteractiveVideo(), loadQRCodeLib(), cleanTextForPdf(), exportPDF_InteractiveVideo() (+43 more)

### Community 2 - "Générateur H5P (sauvegarde)"
Cohesion: 0.04
Nodes (12): genererH5PDictation(), genererH5PSortParagraphs(), genererH5PSummary(), A11Y_SORTPARAGRAPHS, L10N_CROSSWORD, L10N_DICTATION, L10N_DRAGTEXT, L10N_MARKTHEWORDS (+4 more)

### Community 3 - "Corpus & prompts (sauvegarde)"
Cohesion: 0.05
Nodes (35): addSource(), _compressImageIfNeeded(), corpusSources, _fetchAlbertOcr(), _injectModerationStyles(), _shortUrl(), _shortVideoName(), _showModerationBlock() (+27 more)

### Community 4 - "Générateur H5P (copies)"
Cohesion: 0.07
Nodes (9): genererH5PCards(), genererH5PDragQuestion(), genererH5PCategorisation(), genererH5PModele(), genererZIPModele(), H5PGenerator, H5PGenerator, cleanText() (+1 more)

### Community 5 - "Prompts d'activités"
Cohesion: 0.12
Nodes (7): genererPromptIAHierarchise(), genererPrompt_H5PVideo(), preparerAssistantIA_ImagePairing(), error(), log(), logger, warn()

### Community 6 - "Générateurs H5P modules"
Cohesion: 0.13
Nodes (20): genererH5PAccordion(), genererH5PAdvancedBlanks(), genererH5PCrossword(), genererH5PDragQuestion(), genererH5PImagePairing(), blobToBase64(), genererZIPInteractiveMap(), genererH5PMarkTheWords() (+12 more)

### Community 7 - "Générateur H5P principal"
Cohesion: 0.07
Nodes (5): genererH5PCategorisation(), genererH5PModele(), genererZIPModele(), getH5PLangCode(), H5PGenerator

### Community 8 - "Carte interactive"
Cohesion: 0.09
Nodes (27): preparerAssistantIA_InteractiveMap(), base64ToFile(), getInteractiveMapState(), setInteractiveMapState(), addCard(), audioChunks, audioFiles, blobToBase64() (+19 more)

### Community 9 - "Dictée audio"
Cohesion: 0.10
Nodes (28): parserReponseIA_Dictation(), preparerAssistantIA_Dictation(), fileToBase64(), getDictationState(), setDictationState(), addDictationStatement(), askConfirmation(), audioChunks (+20 more)

### Community 10 - "Cartes mémoire"
Cohesion: 0.09
Nodes (23): preparerAssistantIA_Cards(), fileToBase64(), getCardsState(), imageToDataURL(), setCardsState(), addCardItem(), audioChunks, cardAudios (+15 more)

### Community 11 - "Sélecteur d'activités"
Cohesion: 0.17
Nodes (32): init(), createTab(), handleActivityToggle(), isPaneValid(), loadedModules, loadModuleUI(), removeTab(), showToast() (+24 more)

### Community 12 - "Appariements d'images"
Cohesion: 0.10
Nodes (21): preparerPrompt_IdesAppariement(), fileToBase64(), getImagePairingState(), imageToDataURL(), setImagePairingState(), addPairCard(), currentRepartition, gatherData() (+13 more)

### Community 13 - "Labo 3D (UI)"
Cohesion: 0.10
Nodes (18): deduplicateMolecules(), preparerAssistantIA_Molecules3D(), getH5P3DState(), setH5P3DState(), annotationMarkers, attachEventListeners(), closeAnnotationEditor(), displayMoleculesList() (+10 more)

### Community 14 - "Accordéon & connecteurs IA"
Cohesion: 0.11
Nodes (21): callAlbertAPI(), parserReponseIA_Accordion(), preparerAssistantIA_Accordion(), getAccordionState(), setAccordionState(), addAccordionItemCard(), currentRepartition, getUIState() (+13 more)

### Community 15 - "Générateur H5P (sauv. 2)"
Cohesion: 0.10
Nodes (4): genererH5PCategorisation(), genererH5PModele(), genererZIPModele(), H5PGenerator

### Community 16 - "Générateur H5P (copie 3)"
Cohesion: 0.09
Nodes (3): genererH5PCategorisation(), genererH5PModele(), genererZIPModele()

### Community 17 - "Générateur H5P (copie)"
Cohesion: 0.10
Nodes (4): genererH5PCategorisation(), genererH5PModele(), genererZIPModele(), H5PGenerator

### Community 18 - "Corpus-manager (sauvegarde)"
Cohesion: 0.11
Nodes (11): addSource(), buildFinalCorpus(), _compressImageIfNeeded(), corpusManager, corpusSources, _fetchAlbertOcr(), _injectModerationStyles(), _shortUrl() (+3 more)

### Community 19 - "Texte à trous"
Cohesion: 0.14
Nodes (20): preparerAssistantIA_AdvancedBlanks(), getAdvancedBlanksState(), setAdvancedBlanksState(), addRule(), createNewBlankCard(), getUIState(), handleGenerateAlbert(), handleParseResponse() (+12 more)

### Community 20 - "Glisser-déposer"
Cohesion: 0.10
Nodes (11): preparerAssistantIA_Categorisation(), setDragNDropState(), _createNewElement(), currentRepartition, _elements, _genId(), _handlePreparePrompt(), IMAGE_SERVICES (+3 more)

### Community 21 - "Prompt-builder (sauv. RAG)"
Cohesion: 0.15
Nodes (15): genererPromptIAHierarchise(), preparerAssistantIA_Accordion(), preparerAssistantIA_Cards(), preparerAssistantIA_Crossword(), preparerAssistantIA_ImagePairing(), preparerAssistantIA_InteractiveMap(), preparerAssistantIA_Quiz(), preparerAssistantIA_QuizMath() (+7 more)

### Community 22 - "Prompt-builder (sauv. grain)"
Cohesion: 0.15
Nodes (15): genererPromptIAHierarchise(), preparerAssistantIA_Accordion(), preparerAssistantIA_Cards(), preparerAssistantIA_Crossword(), preparerAssistantIA_ImagePairing(), preparerAssistantIA_InteractiveMap(), preparerAssistantIA_Quiz(), preparerAssistantIA_QuizMath() (+7 more)

### Community 23 - "Prompt-builder (copie 2)"
Cohesion: 0.15
Nodes (15): genererPromptIAHierarchise(), preparerAssistantIA_Accordion(), preparerAssistantIA_Cards(), preparerAssistantIA_Crossword(), preparerAssistantIA_ImagePairing(), preparerAssistantIA_InteractiveMap(), preparerAssistantIA_Quiz(), preparerAssistantIA_QuizMath() (+7 more)

### Community 24 - "Frise chronologique"
Cohesion: 0.14
Nodes (16): preparerAssistantIA_Timeline(), getTimelineState(), setTimelineState(), addCard(), currentRepartition, gatherData(), getUIState(), handleParseResponse() (+8 more)

### Community 25 - "Vrai/Faux"
Cohesion: 0.13
Nodes (15): parserReponseIA_TrueFalse(), preparerAssistantIA_TrueFalse(), getTrueFalseState(), setTrueFalseState(), currentRepartition, gatherData(), getUIState(), handleGenerateAlbertTF() (+7 more)

### Community 26 - "Corpus-manager (sauv. vision)"
Cohesion: 0.12
Nodes (6): addSource(), buildFinalCorpus(), corpusManager, corpusSources, _shortUrl(), _shortVideoName()

### Community 27 - "Corpus-manager (sauv. vision 2)"
Cohesion: 0.12
Nodes (6): addSource(), buildFinalCorpus(), corpusManager, corpusSources, _shortUrl(), _shortVideoName()

### Community 28 - "Corpus-manager (sauv. warning)"
Cohesion: 0.12
Nodes (6): addSource(), buildFinalCorpus(), corpusManager, corpusSources, _shortUrl(), _shortVideoName()

### Community 29 - "Quiz Math"
Cohesion: 0.15
Nodes (12): preparerAssistantIA_QuizMath(), getQuizMathState(), setQuizMathState(), addMathAnswerRow(), addMathQuestionCard(), currentRepartition, getUIState(), handleParseIA() (+4 more)

### Community 30 - "Vrai/Faux Math"
Cohesion: 0.15
Nodes (13): preparerAssistantIA_TrueFalseMath(), getTrueFalseMathState(), setTrueFalseMathState(), addTrueFalseStatementCard(), currentRepartition, gatherData(), getUIState(), handleGenerateAlbert() (+5 more)

### Community 31 - "Mots mêlés"
Cohesion: 0.18
Nodes (13): parserReponseIA_WordList(), preparerAssistantIA_WordSearch(), getWordSearchState(), setWordSearchState(), checkStatus(), currentRepartition, gatherData(), getUIState() (+5 more)

### Community 32 - "Quiz QCM"
Cohesion: 0.16
Nodes (11): preparerAssistantIA_Quiz(), getQCMState(), setQCMState(), currentRepartition, gatherData(), getUIState(), handleParseIA(), handlePreparePrompt() (+3 more)

### Community 33 - "Résumé"
Cohesion: 0.17
Nodes (12): parserReponseIA_Summary(), preparerAssistantIA_Summary(), getSummaryState(), setSummaryState(), addSummaryGroupCard(), currentRepartition, getUIState(), handleGenerateAlbertSummary() (+4 more)

### Community 34 - "Étiquettes à déplacer"
Cohesion: 0.22
Nodes (13): preparerAssistantIA_DragText(), getDragTextState(), setDragTextState(), addDragTextRule(), getUIState(), handleParseIADragText(), handlePreparePromptDragText(), handleSelection() (+5 more)

### Community 35 - "Mots à repérer"
Cohesion: 0.22
Nodes (13): preparerAssistantIA_MarkWords(), getMarkTheWordsState(), setMarkTheWordsState(), addMarkTheWordsRule(), getUIState(), handleParseIA(), handlePreparePrompt(), handleSelection() (+5 more)

### Community 36 - "Paragraphes (remise en ordre)"
Cohesion: 0.19
Nodes (12): parserReponseIA_SortParagraphs(), preparerAssistantIA_SortParagraphs(), getSortParagraphsState(), setSortParagraphsState(), addParagraphCard(), currentRepartition, getUIState(), handleGenerateAlbertSortParagraphs() (+4 more)

### Community 37 - "Générateur DragText & libs"
Cohesion: 0.15
Nodes (8): genererH5PDragText(), gatherData(), H5P_FALLBACK_VERSIONS, getFullLibraryString(), getVersion(), h5pLibraryVersions, initPromise, libraryManager

### Community 38 - "Mots croisés"
Cohesion: 0.20
Nodes (11): preparerAssistantIA_Crossword(), getCrosswordState(), setCrosswordState(), addCrosswordItemCard(), currentRepartition, getUIState(), handleGenerateAlbertCrossword(), handleParseIA() (+3 more)

### Community 39 - "Prévisualisation H5P"
Cohesion: 0.22
Nodes (11): getAudioFiles(), handlePreviewHPSingle(), getLibraryPaths(), handleLivePreview(), hide(), lancerPrevisualisation(), libraryCache, loadIframeContent() (+3 more)

### Community 40 - "Molécules 3D (PubChem)"
Cohesion: 0.26
Nodes (9): ATOM_COLORS, ATOM_RADII, createMoleculeScene(), downloadSDF(), exportSceneToGLB(), generateMoleculeGLB(), generateMoleculesGLBBatch(), getCIDFromName() (+1 more)

### Community 41 - "Molécules 3D (PubChem) 2"
Cohesion: 0.26
Nodes (9): ATOM_COLORS, ATOM_RADII, createMoleculeScene(), downloadSDF(), exportSceneToGLB(), generateMoleculeGLB(), generateMoleculesGLBBatch(), getCIDFromName() (+1 more)

### Community 42 - "Éditeur d'image (Fabric)"
Cohesion: 0.23
Nodes (8): history, _initFabricToolbar(), _initHistoryListeners(), _injectModalHTML(), openFabricEditor(), redoStack, _rotateCanvas(), saveState()

### Community 43 - "Contexte BOEN (RAG)"
Cohesion: 0.39
Nodes (8): corpusManager, autoDetectDiscipline(), buildBOPromptBlock(), fetchBOContext(), getTaxonomy(), normalizeNiveauToCode(), genererPromptIAHierarchise(), genererPromptIAHierarchise()

### Community 44 - "Collecte données activités"
Cohesion: 0.20
Nodes (10): getDragNDropState(), gatherData(), gatherData(), gatherData(), getUIState(), gatherData(), gatherData(), gatherData() (+2 more)

### Community 45 - "Parseurs de fichiers"
Cohesion: 0.40
Nodes (8): buildFinalCorpus(), parseOdpFile(), parseOdtFile(), parsePageRange(), parsePptxFile(), performOCR(), readFileContent(), renderPageToCanvas()

### Community 46 - "Labo 3D (export GLB)"
Cohesion: 0.25
Nodes (9): attachDynamicListeners(), blobToBase64(), closeH5PWarning(), handleDownloadGLBSingle(), handleDownloadZIPSingle(), handleGenerateGLB(), nettoyerNomFichier(), proceedWithH5PDownload() (+1 more)

### Community 47 - "Labo 3D (annotations)"
Cohesion: 0.25
Nodes (9): addAnnotationAtPoint(), createMarkerMesh(), deleteAnnotation(), handleAddAnnotationClick(), handleEditAnnotations(), loadAnnotationViewer(), onAnnotationCanvasClick(), renderAnnotationsList() (+1 more)

### Community 49 - "Export PDF molécules"
Cohesion: 0.36
Nodes (5): capture3DSnapshot(), drawChemicalFormula(), exportPDF_MoleculeSingle(), fetchAndProcess2DImage(), handleDownloadPDFSingle()

### Community 50 - "Parsing réponses IA"
Cohesion: 0.39
Nodes (6): nettoyerReponseIA(), parserReponseIA_ImagePairing(), parserReponseIA_MathJSON(), parserReponseIA_Molecules3D(), parserReponseIA_Quiz(), sanitizeAIJsonString()

### Community 52 - "Éditeur mathématique"
Cohesion: 0.43
Nodes (4): handleToolbarClick(), insertSymbol(), insertTextCommand(), mathFields

### Community 53 - "Glisser-déposer (rendu)"
Cohesion: 0.29
Nodes (7): _handleParseIA(), _renderElements(), _renderImageEditor(), _renderUI(), _renderZones(), updateGenerateButtonCallback(), _updateStatusIndicator()

### Community 54 - "Export PDF gliss.-dép. (copie)"
Cohesion: 0.47
Nodes (4): exportPDF_Dragndrop(), getImageData(), stripEmojis(), gatherData()

### Community 56 - "Export PDF glisser-déposer"
Cohesion: 0.60
Nodes (3): exportPDF_Dragndrop(), getImageData(), stripEmojis()

## Knowledge Gaps
- **67 isolated node(s):** `currentRepartition`, `_zones`, `_elements`, `IMAGE_SERVICES`, `currentRepartition` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logger` connect `Prompts d'activités` to `Export ODT`, `Vidéo interactive (H5P/PDF)`, `Générateur H5P (sauvegarde)`, `Corpus & prompts (sauvegarde)`, `Générateurs H5P modules`, `Générateur H5P principal`, `Carte interactive`, `Dictée audio`, `Cartes mémoire`, `Sélecteur d'activités`, `Appariements d'images`, `Labo 3D (UI)`, `Accordéon & connecteurs IA`, `Générateur H5P (copie 3)`, `Corpus-manager (sauvegarde)`, `Texte à trous`, `Glisser-déposer`, `Prompt-builder (sauv. RAG)`, `Prompt-builder (sauv. grain)`, `Prompt-builder (copie 2)`, `Frise chronologique`, `Vrai/Faux`, `Corpus-manager (sauv. vision)`, `Corpus-manager (sauv. vision 2)`, `Corpus-manager (sauv. warning)`, `Quiz Math`, `Vrai/Faux Math`, `Mots mêlés`, `Quiz QCM`, `Résumé`, `Étiquettes à déplacer`, `Mots à repérer`, `Paragraphes (remise en ordre)`, `Générateur DragText & libs`, `Mots croisés`, `Prévisualisation H5P`, `Contexte BOEN (RAG)`, `Parseurs de fichiers`, `Export PDF molécules`, `Parsing réponses IA`, `Éditeur mathématique`, `Export PDF gliss.-dép. (copie)`, `Export PDF glisser-déposer`, `Import/export config`, `Carte interactive (état, copie)`?**
  _High betweenness centrality (0.305) - this node is a cross-community bridge._
- **Why does `getDependencyObject()` connect `Générateur H5P (copies)` to `Générateur H5P (sauvegarde)`, `Générateur DragText & libs`, `Générateurs H5P modules`, `Générateur H5P principal`, `Générateur H5P (sauv. 2)`, `Générateur H5P (copie 3)`, `Générateur H5P (copie)`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `getH5PLocalization()` connect `Générateurs H5P modules` to `Vidéo interactive (H5P/PDF)`, `Générateur H5P (sauvegarde)`, `Générateur H5P (copies)`, `Générateur H5P principal`, `Dictée audio`, `Cartes mémoire`, `Appariements d'images`, `Accordéon & connecteurs IA`, `Générateur H5P (sauv. 2)`, `Générateur H5P (copie 3)`, `Générateur H5P (copie)`, `Frise chronologique`, `Vrai/Faux`, `Vrai/Faux Math`, `Mots mêlés`, `Quiz QCM`, `Résumé`, `Étiquettes à déplacer`, `Mots à repérer`, `Paragraphes (remise en ordre)`, `Générateur DragText & libs`, `Mots croisés`, `Collecte données activités`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `currentRepartition`, `_zones`, `_elements` to the rest of the system?**
  _67 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Export ODT` be split into smaller, more focused modules?**
  _Cohesion score 0.11075949367088607 - nodes in this community are weakly interconnected._
- **Should `Vidéo interactive (H5P/PDF)` be split into smaller, more focused modules?**
  _Cohesion score 0.05472636815920398 - nodes in this community are weakly interconnected._
- **Should `Générateur H5P (sauvegarde)` be split into smaller, more focused modules?**
  _Cohesion score 0.044642857142857144 - nodes in this community are weakly interconnected._