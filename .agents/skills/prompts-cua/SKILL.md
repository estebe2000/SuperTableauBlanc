---
name: prompts-cua
description: Concevoir et optimiser des gabarits de prompts pédagogiques inclusifs et auto-portants — principes CUA, FALC (Inclusion Europe), TEACCH, scénarios sociaux de Carol Gray, Few-Shot learning avec exemples travaillés et garde-fous logiciels post-génération.
---

# Conception de Gabarits de Prompts Pédagogiques Inclusifs (CUA)

Les prompts utilisés dans All' Inclusive (Studio CUA, Clarificateur, Reformulateur, Pas-à-pas) s'adressent à des LLM souverains (Albert, Mistral, Ollama). Ils doivent respecter des standards stricts pour garantir des résultats fiables, éthiques et pédagogiquement rigoureux.

## 1. Le principe « Auto-portant »
Un prompt ne doit jamais supposer que le LLM connaît le contexte de l'application ou des termes implicites. Le prompt doit **définir explicitement ses cadres théoriques** :
- **Clé de Fitzgerald** : Expliciter le code couleur et le classement syntaxique (*Personne, Action, Objet, Lieu, Temps*).
- **FALC (Facile à Lire et à Comprendre)** : Rappeler les règles clés (*phrases courtes sujet-verbe-complément, un mot = une idée, pas de voix passive ni de métaphores ambiguës*).
- **Méthode TEACCH & Découpage séquentiel** : Expliciter la chronologie étape par étape avec verbes d'action à l'infinitif.
- **Scénarios Sociaux (Carol Gray)** : Structure rigoureuse (*phrases descriptives, perspectives, directives et affirmatives*).

## 2. Structure d'un gabarit de prompt
```text
[RÔLE] : Expert pédagogique en inclusion et conception universelle (CUA).
[CONTEXTE] : Niveau scolaire ({niveau}), besoins de l'apprenant ({profil_cua}).
[MISSION / TÂCHE] : Objectif clair formulé en une phrase.
[CONTRAINTES IMPÉRATIVES] :
  1. Règle vérifiable avec justification (ex: "ARASAAC n'indexe que les lemmes à l'infinitif : une forme conjuguée ne renvoie rien").
  2. Cadrage strict du format de sortie (ex: JSON pur, tableau Markdown, diagramme Mermaid).
  3. Interdiction formelle d'inventer des éléments non fournis.
[EXEMPLE TRAVAILLÉ (Few-Shot)] : Un exemple complet et parfait montrant l'entrée type et la sortie attendue.
```

## 3. Garde-fous côté code (Ne jamais faire confiance au LLM sur parole)
Toute contrainte critique demandée au modèle dans le prompt doit être **doublée d'un filtre logiciel en JavaScript** après réception de la réponse :
- Nettoyage des balises `<thought>...</thought>` ou préambules bavards (*« Voici la réponse : »*).
- Normalisation des structures JSON (vérification des champs obligatoires, fallback si format invalide).
- Remplacement des entités HTML dans les blocs Mermaid ou LaTeX.

## 4. Protection des données (RGPD à la source)
Avant tout envoi de prompt au LLM :
- Vérifier l'absence de noms d'élèves, coordonnées ou diagnostics médicaux sensibles non anonymisés.
- Ne transmettre que les besoins fonctionnels d'adaptation (*ex: « fatigue visuelle et besoin d'aération » plutôt que « myopie sévère »*).
