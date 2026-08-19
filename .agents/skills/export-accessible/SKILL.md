---
name: export-accessible
description: Générer et exporter des documents bureautiques accessibles (.odt OpenDocument, .docx, .pdf) en pur JavaScript côté client — charte typographique CUA (Arial 14, interligne 1.5, pas d'italique), structure XML ODF 1.2 sans dépendance serveur.
---

# Génération d'Exports Bureautiques Accessibles (.odt, .docx, .pdf)

Les supports générés par All' Inclusive (fiches de cours du Studio CUA, exercices adaptés du Bureau Virtuel, lexiques ARASAAC) doivent pouvoir être exportés sous forme de fichiers bureautiques standards modifiables par les enseignants et élèves dans LibreOffice Writer, Word ou Google Docs.

## 1. Principes de la Charte Typographique CUA
Dans tous les documents générés :
- **Police accessible** : Arial ou OpenDyslexic.
- **Corps de texte** : Minimum 14 pt pour le corps, 16-18 pt pour les sous-titres, 20-24 pt pour les titres principaux.
- **Interligne & espacements** : Interligne 1.5 minimum, paragraphes aérés.
- **Bannissement de l'italique** : L'italique altère la lisibilité pour les élèves DYS. Toute emphase doit être marquée en **gras**.
- **Encadrés différenciés** : Zones « Consigne », « Aide méthodologique » et « Réponse » matérialisées par des cadres à fond pastel doux avec bordure nette.

## 2. Structure d'un fichier OpenDocument (.odt)
Un fichier `.odt` est un conteneur ZIP standard contenant :
- `mimetype` (texte brut non compressé : `application/vnd.oasis.opendocument.text`, placé impérativement en 1re entrée).
- `META-INF/manifest.xml` (déclaration des entrées).
- `content.xml` (corps du document en XML OpenDocument Text).
- `styles.xml` (définition des styles par défaut).

## 3. Zéro dépendance serveur
La génération d'ODT/DOCX doit s'effectuer **100% côté client** via l'API `Blob` et un encodeur binaire / ZIP léger (stored/deflate), garantissant le fonctionnement hors-ligne complet avec Ollama.
