# `vendor/` — Bibliothèques tierces internalisées (conformité RGPD)

Ce dossier contient **toutes les bibliothèques front-end** auparavant chargées
depuis des CDN tiers (cdnjs, jsDelivr, unpkg, quilljs, hertzen, googleapis,
Mapbox…). Elles sont désormais **servies depuis l'origine HAPI** (GitLab Pages).

## Pourquoi

Charger une ressource depuis un CDN tiers transmet à ce tiers — **avant toute
action et sans consentement** — l'adresse IP du visiteur (donnée personnelle,
CJUE *Breyer* C-582/14) et ses en-têtes HTTP. La plupart de ces CDN sont
hébergés hors UE (États-Unis). Pour un service public d'éducation manipulant
des données d'élèves (souvent mineurs), c'est un risque RGPD majeur — cf. le
jugement LG München I du 20/01/2022 sur Google Fonts.

L'internalisation **supprime intégralement ces flux**. Les seuls flux externes
restants sont souverains (Matomo académique sans cookie, proxy Scaleway du
Ministère, n8n `education.gouv.fr`, IGN Géoplateforme) ou des fonds de carte
(OSM-France par défaut).

## Reproductibilité

Les fichiers sont régénérés par `download-vendor.sh` (versions épinglées) :

```bash
bash vendor/download-vendor.sh        # nécessite npm, curl, tar
```

Ne pas éditer les fichiers `*.min.js` / `*.css` à la main : relancer le script
pour toute mise à jour de version.

## Notes

* **MathJax 3** (`mathjax/es5`) : `window.MathJax.loader.paths.mathjax` pointe
  sur la copie locale (`ia/index.html`) — aucun composant (y compris a11y)
  n'est chargé depuis un CDN.
* **MathJax 2.7.5** (`mathjax-2.7.5`) : copie distincte requise par la librairie
  H5P `H5P.MathDisplay` (viewer H5P), qui utilise l'API v2 `MathJax.Hub.Queue`
  et chargerait sinon MathJax depuis cdnjs (bloqué par la CSP). Pointée via
  `H5PIntegration.libraryConfig['H5P.MathDisplay']` dans `ia/h5p-viewer.html`.
  Sous-ensemble `?config=TeX-AMS_HTML` (entrée TeX, sortie HTML-CSS, polices TeX).
* **Tesseract** : `workerPath` / `corePath` / `langPath` sont fixés localement
  dans `ia/modules/corpus/file-parsers.js` (worker + cœur WASM + modèle `fra`).
* **model-viewer** : embarqué dans les paquets ZIP « molécule 3D » exportés ;
  les GLB exportés étant non compressés, aucun décodeur Draco/KTX2 distant.
* **Leaflet (+ plugins)** : embarqué dans les paquets ZIP « carte interactive »
  exportés (dossier `libs/`). Seules les **tuiles de fond** restent servies par
  leur fournisseur (OSM-France par défaut, souverain).
