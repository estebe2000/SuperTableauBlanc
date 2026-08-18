// Shim ESM local pour JSZip (remplace l'ancien import +esm hébergé sur jsDelivr).
// Charge le bundle UMD (qui s'enregistre sur globalThis) puis le ré-exporte.
import './jszip.min.js';
const JSZip = globalThis.JSZip;
export default JSZip;
export { JSZip };
