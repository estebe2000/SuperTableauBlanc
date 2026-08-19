---
name: verification-ebep
description: Protocole de test et validation rigoureux pour All' Inclusive — build Vite sans erreur, responsive à 390px/820px/1280px, contrôle CORS des proxies (Albert, ILaaS), vérification des connexions LLM et validation des packs .stb.
---

# Protocole de Vérification et Tests Qualité (EBEP)

Avant de livrer ou déployer toute modification sur All' Inclusive, suivre impérativement ce protocole de validation à 5 étapes :

## 1. Validation de la compilation (Build)
```bash
npm run build
```
Vérifier que Vite compile sans aucun warning ni erreur de syntaxe JS/CSS.

## 2. Contrôle de mise en page & Responsive
Vérifier l'interface sur 3 largeurs d'écran clés :
- **Desktop (1280 px)** : Disposition équilibrée, panneaux latéraux lisibles.
- **Tablette (820 px)** : Adaptation des colonnes du Bureau Virtuel.
- **Mobile (390 px)** : Absence absolue de débordement horizontal (`scrollWidth === clientWidth`).

## 3. Test de connectivité des fournisseurs d'IA
- **Albert (État français)** : Vérifier que le proxy `/proxy-albert` intercepte bien les pré-requêtes `OPTIONS` avec `Access-Control-Allow-Origin: *`.
- **ILaaS (Université Le Havre Normandie)** : Vérifier la compatibilité des endpoints de modèles et chat.
- **Ollama Local** : Vérifier que le mode hors-ligne continue de répondre sur `http://localhost:11434`.

## 4. Intégrité des Packs de cours « .stb »
Vérifier que les fichiers `.stb` exportés ou importés sont des archives JSON valides contenant :
- Métadonnées (titre, niveau, auteur, profil CUA cible),
- Fiche de cours structurée,
- Activités interactives associées,
- Lexique / Transcription CUA.
