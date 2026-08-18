# All' Inclusive (A.I.) 🎓✨

> **« All' Inclusive : L'AI pour tous, sauf les touristes. »**

[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT / AGPLv3](https://img.shields.io/badge/License-MIT%20%2F%20AGPLv3-blue.svg)](#-licence)
[![RGPD](https://img.shields.io/badge/RGPD-Conforme-16a34a?logo=shield&logoColor=white)](#-souverainet%C3%A9-et-protection-des-donn%C3%A9es)
[![CUA / UDL](https://img.shields.io/badge/P%C3%A9dagogie-CUA%20%2F%20UDL-7c3aed)](#-p%C3%A9dagogie-et-conception-universelle-cua)
[![Démo en ligne](https://img.shields.io/badge/D%C3%A9mo-Forge%20des%20Communs%20Num%C3%A9riques-fc6d26?logo=gitlab&logoColor=white)](https://pytelsteeve.forge.apps.education.fr/SuperTableauBlanc/)

🌐 **Accéder à la démo en ligne (Forge des Communs Numériques)** :  
👉 **[https://pytelsteeve.forge.apps.education.fr/SuperTableauBlanc/](https://pytelsteeve.forge.apps.education.fr/SuperTableauBlanc/)**

---

**All' Inclusive (EBEP)** est un portail pédagogique souverain conçu pour mettre l'intelligence artificielle au service de l'**éducation inclusive** et de la réussite de tous les apprenants (élèves à besoins éducatifs particuliers : DYS, TDAH, TSA, HPI...).

Il fournit aux enseignants, accompagnants (AESH/AVS) et élèves un ensemble d'outils intelligents pour lever les obstacles d'apprentissage, diversifier les supports et alléger la charge cognitive.

---

## 🌟 Points Clés & Philosophie

- **Inclusion par le Design (CUA / UDL)** : Application concrète des principes de la *Conception Universelle de l'Apprentissage* (multiples modes de représentation, d'expression et d'engagement).
- **100% Souverain & Respectueux du RGPD** : Fonctionne au choix avec des modèles locaux (**Ollama**, **LocalAI**) ou des API souveraines étatiques et européennes (**Albert** de l'État français, **Mistral AI**, plateforme ILaaS de l'**Université Le Havre Normandie**). Aucune donnée d'élève n'est transmise à des tiers commerciaux.
- **Formats de Cours « .stb »** : Format de paquet pédagogique structuré et réutilisable (en hommage à *Steeve, Tram et Boris*, initiateurs du projet).
- **Accessibilité Native** : Thèmes contrastés, polices adaptées aux DYS (OpenDyslexic, Lexend), synthèse vocale, transcription et allègement cognitif.

---

## 🛠️ Modules & Outils Disponibles

### 🤝 Facilitateur d'Apprentissage & Compensation Cognitive
| Outil | Description | Public cible / Usages |
| :--- | :--- | :--- |
| **👁️ Vision & Décripteur** | Analyse multimodale d'images, extraction OCR de documents, explicitation spatiale et schématique. | Malvoyance, DYS, décryptage visuel |
| **🧩 Pas-à-Pas (Tâches)** | Décomposition d'une consigne ou d'un projet complexe en micro-tâches séquencées (granularité 1 à 5). | TDAH, fonctions exécutives, méthodologie |
| **✍️ Reformulateur** | Adaptation du registre de langue (FALC - Facile À Lire et à Comprendre, standard, soutenu, concis). | Allophonie, DYS, communication écrite |
| **🧭 Décrypteur d'Intention** | Analyse du sous-texte, des émotions et des ambiguïtés relationnelles d'un message reçu. | TSA, habiletés sociales, clarté relationnelle |
| **🎙️ Voice AI (Audio)** | Transcription audio fidèle avec horodatage et génération de 5 formats visuels CUA (cartes mentales, tuiles). | Prise de notes, soutien auditif/visuel |
| **🎤 Dictée Vocale (Mic)** | Retranscription audio en direct pour la saisie sans clavier. | Dysgraphie, fatigue motrice |

### 🧑‍🏫 Conception Pédagogique & Espaces Dédiés
| Outil / Espace | Description |
| :--- | :--- |
| **💡 Clarificateur de Concepts** | Explication multi-angles d'une notion (langage simple, métaphores concrètes, schémas, définitions). |
| **🎓 Studio Pédagogique CUA** | Création de séances de cours inclusives conformes aux programmes officiels avec export de packs `.stb`. |
| **🐝 HAPI (DRANE Normandie)** | Intégration du générateur d'activités interactives (H5P, quiz, flashcards) de la DRANE Normandie. |
| **📋 Bureau Enseignant / AESH** | Espace de travail pour piloter les séances, gérer les adaptations de la classe et déployer les packs `.stb`. |
| **🧑‍🎓 Espace Élève** | Interface épurée pour l'apprenant : lecture immersive, synthèse vocale, personnalisation typographique. |
| **🧬 Profils CUA (Profiling)** | Générateur et gestionnaire de profils d'adaptations personnalisés (PAP, PPS, PAI). |

---

## 🏗️ Architecture & Technologies

- **Frontend** : Vanilla HTML5 / CSS3 / JavaScript (ES Modules modernes, sans framework lourd).
- **Tooling & Build** : [Vite 5](https://vitejs.dev/) avec serveur proxy intégré (gestion CORS & WebSockets).
- **Fournisseurs d'IA supportés** :
  - **Albert** (DINUM / Etalab - État Français)
  - **ILaaS** (Université Le Havre Normandie)
  - **Mistral AI**
  - **Ollama** (Inférence locale offline : Gemma, Llama, Mistral, Whisper, etc.)
  - **LocalAI** (Compatible OpenAI API)
- **Déploiement** : Docker / Docker Compose / Nginx Reverse Proxy.

---

## 🚀 Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) (v18+) et `npm`
- *(Optionnel pour le mode local)* [Ollama](https://ollama.ai/) installé avec un modèle vision et texte (ex. `gemma4:12b`, `mistral`).

### 1. Installation en Local (Mode Développement)

```bash
# 1. Cloner le dépôt
git clone https://github.com/estebe2000/SuperTableauBlanc.git
cd SuperTableauBlanc

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

L'application est accessible sur `http://localhost:5173`.

### 2. Lancement avec Docker

```bash
# Démarrer le conteneur en environnement de dev
docker compose up -d --build
```

---

## ⚙️ Configuration des Modèles et Fournisseurs

Rendez-vous dans l'onglet **⚙️ Paramètres** de l'application pour configurer vos accès :

### 1. Albert (État français / DINUM)
- **URL pour la version en ligne (Forge / Web)** :  
  ```text
  https://ebep.educ-ai.fr/proxy-albert/v1
  ```
  *(Passerelle proxy sécurisée prenant en charge le CORS pour les navigateurs web)*
- **URL en local / Docker** : `/proxy-albert/v1`
- **Clé d'API** : Votre clé d'API Albert (`sk-...`)
- **Modèles recommandés** :
  - Texte & Raisonnement : `openai/gpt-oss-120b` ou `mistral-small-3-2-24b-instruct-2506`
  - Vision & Décripteur : `ministral-3-8b-instruct-2512` ou `mistral-small-3-2-24b-instruct-2506`
  - Audio & Transcription : `openai/whisper-large-v3`

### 2. ILaaS (Université Le Havre Normandie)
- **URL** : `https://litellm-pp.univ-lehavre.fr/v1` *(autorise nativement les requêtes depuis la Forge)*
- **Clé d'API** : Votre token d'accès ILaaS

### 3. Ollama (100% Local & Hors-ligne)
- **URL** : `http://localhost:11434` (aucun token nécessaire)
- *Note pour l'utilisation depuis le web* : Lancer Ollama avec `OLLAMA_ORIGINS="*" ollama serve` pour autoriser les requêtes cross-origin du navigateur.

---

## 🔒 Souveraineté et Protection des Données (RGPD)

All' Inclusive applique une politique stricte de confidentialité :
1. **Aucune conservation de données nominatives** : Les données saisies et les fichiers téléversés ne sont conservés sur aucun serveur publicitaire ou commercial.
2. **Hébergement Académique** : Déployé sur les infrastructures de l'**Université Le Havre Normandie**.
3. **Mode Hors-Ligne Total** : Possibilité d'exécuter l'intégralité de la chaîne logicielle en local sans accès Internet via Ollama.

---

## 🌱 Communs Numériques & Remerciements

All' Inclusive s'inscrit dans la dynamique des communs numériques pour l'éducation :
- **[goblin.tools](https://goblin.tools/)** *(Bram De Buyser)* : Inspiration ergonomique pour les mécanismes d'allègement de la charge mentale. (*Réimplémentation souveraine indépendante*).
- **[HAPI](https://drane-normandie.forge.apps.education.fr/hapi/)** *(DRANE Normandie)* : Module de création d'activités interactives de la Forge des Communs Numériques.
- **Université Le Havre Normandie** : Soutien technique, hébergement et infrastructure d'inférence académique ILaaS.

---

## 📄 Licence

Ce projet est distribué sous double licence libre et open source au choix :
- **[Licence MIT](https://opensource.org/licenses/MIT)** : Pour une réutilisation libre, permissive et une intégration facile.
- **[GNU AGPLv3 (Affero General Public License v3)](https://www.gnu.org/licenses/agpl-3.0.fr.html)** : Pour garantir le partage des améliorations et la préservation des communs numériques dans les services en réseau et éducatifs.

Projet académique développé dans le cadre de l'innovation pédagogique, de l'accessibilité universelle et des communs numériques pour l'éducation.  
Pour toute question ou contribution : ouvrir une issue ou contacter l'équipe projet.