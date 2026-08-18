POLICE MARIANNE — à déposer ici
================================

La police « Marianne » est la typographie officielle de l'État français,
LIBRE et GRATUITE d'utilisation.

Où la télécharger
-----------------
- Système de Design de l'État (DSFR) : https://www.systeme-de-design.gouv.fr/
  (rubrique « Fondamentaux » > « Typographie », ou le paquet npm @gouvfr/dsfr,
   dossier dist/fonts/)
- Les fichiers .woff2 s'y trouvent sous le dossier des fontes.

Fichiers attendus dans CE dossier (css/fonts/)
----------------------------------------------
Le CSS (css/styles.css, blocs @font-face) référence EXACTEMENT ces noms :

    Marianne-Light.woff2            (graisse 300)
    Marianne-Regular.woff2          (graisse 400)
    Marianne-Regular_Italic.woff2   (400 italique)
    Marianne-Medium.woff2           (graisse 500)
    Marianne-Bold.woff2             (graisse 700)
    Marianne-Bold_Italic.woff2      (700 italique)

Renomme au besoin pour coller à ces noms (selon la source, les fichiers
peuvent s'appeler « Marianne-RegularItalic.woff2 » sans underscore, etc.).

En attendant
------------
Tant que les fichiers ne sont pas présents, l'affichage retombe proprement
sur Segoe UI (font-display: swap) — rien n'est cassé. Dès qu'ils sont là,
TOUS les thèmes (vert, océan, … et DSFR) utilisent Marianne automatiquement.
