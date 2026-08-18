#!/usr/bin/env bash
# =============================================================================
# HAPI — Internalisation des bibliothèques tierces (conformité RGPD)
# -----------------------------------------------------------------------------
# Récupère localement toutes les bibliothèques auparavant chargées depuis des
# CDN tiers (cdnjs, jsDelivr, unpkg, quilljs, hertzen, googleapis…) afin de les
# servir depuis l'origine HAPI (GitLab Pages). Aucune donnée personnelle
# (adresse IP, en-têtes) n'est alors transmise à un tiers.
#
# Reproductible : versions épinglées. À relancer pour mettre à jour.
#   Prérequis : npm, curl, tar.   Usage : bash vendor/download-vendor.sh
# =============================================================================
set -euo pipefail

VENDOR_DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
NPM_CACHE="$TMP/.npmcache"
trap 'rm -rf "$TMP"' EXIT

echo "Vendor → $VENDOR_DIR"
echo "Temp   → $TMP"

# npm pack <pkg>@<ver> dans $TMP puis extrait dans $TMP/<dir>
fetch_npm() {
  local spec="$1" out="$2"
  echo "  • npm pack $spec"
  ( cd "$TMP" && npm pack "$spec" --cache "$NPM_CACHE" --silent >/dev/null )
  local tgz; tgz="$(cd "$TMP" && ls -t *.tgz | head -1)"
  mkdir -p "$TMP/$out"
  tar -xzf "$TMP/$tgz" -C "$TMP/$out" --strip-components=1
  rm -f "$TMP/$tgz"
}

copy() { mkdir -p "$(dirname "$2")" && cp "$1" "$2"; }

# --- jQuery 3.7.1 ---------------------------------------------------------
fetch_npm "jquery@3.7.1" jquery
copy "$TMP/jquery/dist/jquery.min.js" "$VENDOR_DIR/jquery/jquery.min.js"

# --- JSZip 3.10.1 (UMD + shim ESM) ---------------------------------------
fetch_npm "jszip@3.10.1" jszip
copy "$TMP/jszip/dist/jszip.min.js" "$VENDOR_DIR/jszip/jszip.min.js"
cat > "$VENDOR_DIR/jszip/jszip.esm.js" <<'EOF'
// Shim ESM local pour JSZip (remplace https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm)
// Charge le bundle UMD (qui s'enregistre sur globalThis) puis le ré-exporte.
import './jszip.min.js';
const JSZip = globalThis.JSZip;
export default JSZip;
export { JSZip };
EOF

# --- PDF.js 2.16.105 ------------------------------------------------------
fetch_npm "pdfjs-dist@2.16.105" pdfjs
copy "$TMP/pdfjs/build/pdf.min.js"        "$VENDOR_DIR/pdfjs/pdf.min.js"
copy "$TMP/pdfjs/build/pdf.worker.min.js" "$VENDOR_DIR/pdfjs/pdf.worker.min.js"

# --- Mammoth 1.7.0 --------------------------------------------------------
fetch_npm "mammoth@1.7.0" mammoth
copy "$TMP/mammoth/mammoth.browser.min.js" "$VENDOR_DIR/mammoth/mammoth.browser.min.js"

# --- Sortable 1.15.2 ------------------------------------------------------
fetch_npm "sortablejs@1.15.2" sortable
copy "$TMP/sortable/Sortable.min.js" "$VENDOR_DIR/sortable/Sortable.min.js"

# --- MathQuill 0.10.1 -----------------------------------------------------
fetch_npm "mathquill@0.10.1" mathquill
copy "$TMP/mathquill/build/mathquill.min.js" "$VENDOR_DIR/mathquill/mathquill.min.js"
copy "$TMP/mathquill/build/mathquill.css"    "$VENDOR_DIR/mathquill/mathquill.css"

# --- KaTeX 0.16.9 (js + css + polices) ------------------------------------
fetch_npm "katex@0.16.9" katex
copy "$TMP/katex/dist/katex.min.js"  "$VENDOR_DIR/katex/katex.min.js"
copy "$TMP/katex/dist/katex.min.css" "$VENDOR_DIR/katex/katex.min.css"
mkdir -p "$VENDOR_DIR/katex/fonts"
cp "$TMP/katex/dist/fonts/"*.woff2 "$VENDOR_DIR/katex/fonts/"

# --- Fabric.js 5.3.1 (npm sans bundle navigateur → fetch direct) ----------
mkdir -p "$VENDOR_DIR/fabric"
curl -fsSL "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" \
  -o "$VENDOR_DIR/fabric/fabric.min.js"

# --- jsPDF 2.5.1 ----------------------------------------------------------
fetch_npm "jspdf@2.5.1" jspdf
copy "$TMP/jspdf/dist/jspdf.umd.min.js" "$VENDOR_DIR/jspdf/jspdf.umd.min.js"

# --- html2pdf.js 0.10.1 ---------------------------------------------------
fetch_npm "html2pdf.js@0.10.1" html2pdf
copy "$TMP/html2pdf/dist/html2pdf.bundle.min.js" "$VENDOR_DIR/html2pdf/html2pdf.bundle.min.js"

# --- QRious 4.0.2 ---------------------------------------------------------
fetch_npm "qrious@4.0.2" qrious
copy "$TMP/qrious/dist/qrious.min.js" "$VENDOR_DIR/qrious/qrious.min.js"

# --- qrcode (davidshimjs/qrcodejs, build cdnjs 1.5.1) ---------------------
mkdir -p "$VENDOR_DIR/qrcodejs"
curl -fsSL "https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js" \
  -o "$VENDOR_DIR/qrcodejs/qrcode.min.js"

# --- Font Awesome 4.7.0 (css + polices) -----------------------------------
fetch_npm "font-awesome@4.7.0" fa
copy "$TMP/fa/css/font-awesome.min.css" "$VENDOR_DIR/fontawesome/css/font-awesome.min.css"
mkdir -p "$VENDOR_DIR/fontawesome/fonts"
cp "$TMP/fa/fonts/"* "$VENDOR_DIR/fontawesome/fonts/"

# --- html2canvas 1.4.1 ----------------------------------------------------
fetch_npm "html2canvas@1.4.1" html2canvas
copy "$TMP/html2canvas/dist/html2canvas.min.js" "$VENDOR_DIR/html2canvas/html2canvas.min.js"

# --- Quill 1.3.6 ----------------------------------------------------------
fetch_npm "quill@1.3.6" quill
copy "$TMP/quill/dist/quill.min.js"  "$VENDOR_DIR/quill/quill.min.js"
copy "$TMP/quill/dist/quill.snow.css" "$VENDOR_DIR/quill/quill.snow.css"

# --- Leaflet 1.9.4 (js + css + images) ------------------------------------
fetch_npm "leaflet@1.9.4" leaflet
copy "$TMP/leaflet/dist/leaflet.js"  "$VENDOR_DIR/leaflet/leaflet.js"
copy "$TMP/leaflet/dist/leaflet.css" "$VENDOR_DIR/leaflet/leaflet.css"
mkdir -p "$VENDOR_DIR/leaflet/images"
cp "$TMP/leaflet/dist/images/"* "$VENDOR_DIR/leaflet/images/"

# --- Leaflet.fullscreen 1.0.1 (remplace api.mapbox.com) -------------------
fetch_npm "leaflet-fullscreen@1.0.1" lfs
copy "$TMP/lfs/dist/Leaflet.fullscreen.min.js" "$VENDOR_DIR/leaflet-fullscreen/Leaflet.fullscreen.min.js"
copy "$TMP/lfs/dist/leaflet.fullscreen.css"    "$VENDOR_DIR/leaflet-fullscreen/leaflet.fullscreen.css"
if [ -f "$TMP/lfs/dist/fullscreen.png" ]; then cp "$TMP/lfs/dist/"*.png "$VENDOR_DIR/leaflet-fullscreen/"; fi

# --- leaflet-side-by-side (digidem, build gh-pages = fichier unique) ------
mkdir -p "$VENDOR_DIR/leaflet-side-by-side"
curl -fsSL "https://cdn.jsdelivr.net/gh/digidem/leaflet-side-by-side@gh-pages/leaflet-side-by-side.min.js" \
  -o "$VENDOR_DIR/leaflet-side-by-side/leaflet-side-by-side.min.js"

# --- Mermaid 11 (docs) ----------------------------------------------------
fetch_npm "mermaid@11" mermaid
copy "$TMP/mermaid/dist/mermaid.min.js" "$VENDOR_DIR/mermaid/mermaid.min.js"

# --- MathJax 3 (tex-mml-chtml + sortie chtml + polices) -------------------
fetch_npm "mathjax@3" mathjax
mkdir -p "$VENDOR_DIR/mathjax/es5"
cp -R "$TMP/mathjax/es5/." "$VENDOR_DIR/mathjax/es5/"

# --- MathJax 2.7.5 (requis par H5P.MathDisplay) --------------------------
# La librairie H5P.MathDisplay (viewer H5P) attend l'API MathJax v2
# (MathJax.Hub.Queue) et charge sinon MathJax 2.7.5 depuis cdnjs — bloqué par
# la CSP. On vendorise un sous-ensemble fonctionnel pour ?config=TeX-AMS_HTML
# (entrée TeX, sortie HTML-CSS, polices TeX) ; on écarte unpacked/docs/test,
# la sortie SVG et les autres familles de polices pour limiter le poids.
fetch_npm "mathjax@2.7.5" mathjax2
MJ2="$VENDOR_DIR/mathjax-2.7.5"
rm -rf "$MJ2"; mkdir -p "$MJ2/config" "$MJ2/fonts/HTML-CSS"
cp "$TMP/mathjax2/MathJax.js" "$MJ2/"
cp "$TMP/mathjax2/LICENSE"    "$MJ2/" 2>/dev/null || true
cp "$TMP/mathjax2/config/TeX-AMS_HTML.js" "$MJ2/config/"
cp -R "$TMP/mathjax2/jax"          "$MJ2/jax"
cp -R "$TMP/mathjax2/extensions"   "$MJ2/extensions"
cp -R "$TMP/mathjax2/localization" "$MJ2/localization"
cp -R "$TMP/mathjax2/fonts/HTML-CSS/TeX" "$MJ2/fonts/HTML-CSS/TeX"
# Sorties non utilisées (config = HTML-CSS) + métadonnées des polices non livrées
rm -rf "$MJ2"/jax/output/SVG "$MJ2"/jax/output/NativeMML "$MJ2"/jax/output/PreviewHTML \
       "$MJ2"/jax/output/PlainSource "$MJ2"/jax/output/CommonHTML
for f in Asana-Math Gyre-Pagella Gyre-Termes Latin-Modern Neo-Euler STIX-Web STIX; do
  rm -rf "$MJ2/jax/output/HTML-CSS/fonts/$f"
done

# --- Three.js 0.160.0 (module + addons utilisés) --------------------------
fetch_npm "three@0.160.0" three
copy "$TMP/three/build/three.module.js" "$VENDOR_DIR/three/three.module.js"
for f in controls/OrbitControls.js environments/RoomEnvironment.js \
         exporters/GLTFExporter.js loaders/GLTFLoader.js \
         utils/BufferGeometryUtils.js utils/TextureUtils.js; do
  copy "$TMP/three/examples/jsm/$f" "$VENDOR_DIR/three/addons/$f"
done

# --- model-viewer 3.5.0 (embarqué dans les exports « molécule 3D ») -------
# Web component autonome ; les décodeurs Draco/KTX2 (gstatic) ne sont chargés
# que pour des GLB compressés — HAPI exporte des GLB non compressés.
mkdir -p "$VENDOR_DIR/model-viewer"
curl -fsSL "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js" \
  -o "$VENDOR_DIR/model-viewer/model-viewer.min.js"

# --- Tesseract.js 5 (worker + cœur WASM + modèle FR) ----------------------
fetch_npm "tesseract.js@5" tjs
copy "$TMP/tjs/dist/tesseract.min.js" "$VENDOR_DIR/tesseract/tesseract.min.js"
copy "$TMP/tjs/dist/worker.min.js"    "$VENDOR_DIR/tesseract/worker.min.js"
fetch_npm "tesseract.js-core@5" tcore
mkdir -p "$VENDOR_DIR/tesseract/core"
cp "$TMP/tcore/"*.wasm "$VENDOR_DIR/tesseract/core/" 2>/dev/null || true
cp "$TMP/tcore/"*.wasm.js "$VENDOR_DIR/tesseract/core/" 2>/dev/null || true
mkdir -p "$VENDOR_DIR/tesseract/lang"
echo "  • langue FR (fra.traineddata.gz)"
curl -fsSL "https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int/fra.traineddata.gz" \
  -o "$VENDOR_DIR/tesseract/lang/fra.traineddata.gz" \
  || curl -fsSL "https://tessdata.projectnaptha.com/4.0.0/fra.traineddata.gz" \
     -o "$VENDOR_DIR/tesseract/lang/fra.traineddata.gz"

echo "✅ Internalisation terminée."
