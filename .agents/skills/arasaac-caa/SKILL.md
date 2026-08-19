---
name: arasaac-caa
description: Intégrer et manipuler les pictogrammes ARASAAC et la Communication Alternative et Améliorée (CAA) — API publique ARASAAC, gestion des variantes (couleur/NB, temps de verbe, pluriel), tableaux de communication, bande phrases et attribution obligatoire CC BY-NC-SA.
---

# Pictogrammes ARASAAC & Communication Alternative et Améliorée (CAA)

ARASAAC (https://arasaac.org) est la banque internationale de pictogrammes libres mise à disposition par le Gouvernement d'Aragon (Espagne). L'API est publique, gratuite, sans clé d'authentification requise et ouverte en CORS.

## 1. Endpoints & URLs d'images
- **API de recherche** : `https://api.arasaac.org/v1/pictograms/fr/bestsearch/{terme}` ou `search/{terme}`
- **CDN Statique (Images de base sans variante)** :
  `https://static.arasaac.org/pictograms/{id}/{id}_{resolution}.png` (résolutions : `300`, `500`, `2500` px).
- **API Dynamique (Variantes de temps, pluriel, noir & blanc)** :
  `https://api.arasaac.org/v1/pictograms/{id}?plural={true|false}&action={past|future}&color={true|false}&resolution=500&url=false`
  > ⚠️ **Règle vitale** : Le CDN statique renvoie une erreur 404 sur les variantes tant qu'elles n'ont pas été générées par l'API. Pour toute variante (flexion de temps, marque de pluriel, version N&B), appeler impérativement l'endpoint API.

## 2. Clé de Fitzgerald (Code couleur syntaxique)
Dans les tableaux de communication et l'affichage des pictogrammes, les catégories suivent la convention d'Edith Fitzgerald :
- **Personnes / Sujets** : Jaune (`#fef08a` / `#ca8a04`)
- **Verbes / Actions** : Vert (`#bbf7d0` / `#16a34a`)
- **Objets / Noms** : Orange (`#fed7aa` / `#ea580c`)
- **Adjectifs / Qualités** : Bleu (`#bfdbfe` / `#2563eb`)
- **Social / Formules de politesse** : Rose / Violet (`#fbcfe8` / `#db2777`)
- **Lieux / Divers** : Blanc / Gris (`#f3f4f6` / `#4b5563`)

*Toujours inscrire le libellé textuel de la famille sous la case pour l'accessibilité universelle.*

## 3. Crédit légal obligatoire
Conformément à la licence **CC BY-NC-SA 4.0**, toute interface ou document exporté utilisant ARASAAC doit mentionner :
> *« Pictogrammes : ARASAAC (https://arasaac.org) — Auteur : Sergio Palao, Propriété : Gouvernement d'Aragon, Licence : CC BY-NC-SA. »*
