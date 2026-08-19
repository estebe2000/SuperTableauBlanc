---
name: accessibilite-ebep
description: Contrôler et garantir l'accessibilité universelle sur All' Inclusive (SuperTableauBlanc) — RGAA 4.1, CUA/UDL, clé de Fitzgerald doublée texte/couleur, statuts aria-live, navigation clavier, polices DYS (OpenDyslexic, Lexend) et confort visuel. À utiliser pour toute modification d'interface.
---

# Accessibilité Universelle & Conception Pédagogique Inclusive (CUA / UDL)

L'application outille l'inclusion scolaire et universitaire : une interface inaccessible contredirait directement son objet fondamental. Référence : **RGAA 4.1** et principes de la **Conception Universelle de l'Apprentissage (CUA)** de CAST.

## 1. La règle cardinale de perception
**La couleur ne porte jamais seule une information** (WCAG 1.4.1).

- Toute couleur thématique ou grammaticale (ex. *Clé de Fitzgerald* pour la CAA) doit être **systématiquement doublée du libellé textuel** de la catégorie (*« Personne »*, *« Action »*, *« Objet »*, *« Lieu »*).
- Les pictogrammes et icônes porteurs de sens possèdent un texte alternatif explicite (`alt="Pictogramme : mange (passé)"`).

## 2. Structure et sémantique HTML5
- Hiérarchie de titres sans saut (`h1` unique, `h2`, `h3`).
- Séparation stricte : `<button>` pour exécuter une action, `<a>` pour la navigation. Jamais de `<div>` ou `<span>` cliquable sans rôle ARIA approprié.
- Formulaires structurés : `<fieldset>` et `<legend>` pour regrouper les options d'adaptation.

## 3. États dynamiques et messages vocaux (Lecteurs d'écran)
- **Modifications en direct** : Tout changement de statut ou notification dynamique doit être encapsulé dans un conteneur `aria-live="polite"` (`role="status"`).
- **Erreurs et alertes** : Utiliser `role="alert"` ou `aria-live="assertive"`.
- **Boutons d'état** : Expliciter les bascules via `aria-pressed="true|false"` et les tiroirs/panneaux via `aria-expanded="true|false"`.
- **Éléments décoratifs** : Icônes d'ambiance, animations d'ondes vocales et auras neurales doivent porter `aria-hidden="true"`.

## 4. Navigation au clavier et motricité
- L'intégralité des fonctionnalités (formulaires, bureau virtuel, sélecteurs) doit être opérable **sans souris**.
- Indicateur de focus (`:focus-visible`) toujours net et visible (jamais de `outline: none` orphelin).
- Cibles tactiles d'au moins 44x44 px pour les commandes principales et 28 px minimum pour les secondaires.

## 5. Adaptabilité cognitive & neuro-diversité
- Prise en charge native des polices adaptées (OpenDyslexic, Lexend, Arial).
- Réglages fins de l'interlignage (1.5 min), de l'espacement des mots et des contrastes (thèmes sombre / clair / sépia / fort contraste).
- Respect impératif de `@media (prefers-reduced-motion)` pour désactiver les animations visuelles distrayantes pour les élèves TDAH ou autistes.
- Aucun débordement horizontal (`scrollWidth > clientWidth`) vérifié sur Desktop (1280px), Tablette (820px) et Mobile (390px).
