/**
 * Module de génération de modèles 3D moléculaires (GLB) 
 * à partir de l'API PubChem - Version JavaScript pure (client-side)
 * 
 * Fichier: modules/generation/pubchem-3d-generator.js
 * 
 * Utilisation:
 * import { generateMoleculeGLB } from './pubchem-3d-generator.js';
 * const glbUrl = await generateMoleculeGLB('water');
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * Couleurs CPK (Corey-Pauling-Koltun) pour les atomes
 */
const ATOM_COLORS = {
    'H': 0xFFFFFF,  // Blanc
    'C': 0x909090,  // Gris foncé
    'N': 0x3050F8,  // Bleu
    'O': 0xFF0D0D,  // Rouge
    'F': 0x90E050,  // Vert clair
    'Cl': 0x1FF01F, // Vert
    'Br': 0xA62929, // Marron
    'I': 0x940094,  // Violet
    'P': 0xFF8000,  // Orange
    'S': 0xFFFF30,  // Jaune
    'B': 0xFFB5B5,  // Rose
    'Na': 0xAB5CF2, // Violet
    'Mg': 0x8AFF00, // Vert lime
    'Al': 0xBFA6A6, // Gris rose
    'Si': 0xF0C8A0, // Beige
    'K': 0x8F40D4,  // Violet foncé
    'Ca': 0x3DFF00, // Vert vif
    'Fe': 0xE06633, // Orange rouille
    'Cu': 0xC88033, // Cuivre
    'Zn': 0x7D80B0, // Bleu gris
    'default': 0xFF1493 // Rose vif (pour atomes inconnus)
};

/**
 * Rayons de Van der Waals des atomes (en Ångströms)
 */
const ATOM_RADII = {
    'H': 1.20,
    'C': 1.70,
    'N': 1.55,
    'O': 1.52,
    'F': 1.47,
    'Cl': 1.75,
    'Br': 1.85,
    'I': 1.98,
    'P': 1.80,
    'S': 1.80,
    'B': 1.92,
    'Na': 2.27,
    'Mg': 1.73,
    'Al': 1.84,
    'Si': 2.10,
    'K': 2.75,
    'Ca': 2.31,
    'Fe': 2.00,
    'Cu': 1.40,
    'Zn': 1.39,
    'default': 1.70
};

/**
 * Recherche un composé sur PubChem et retourne son CID
 * @param {string} searchTerm - Nom ou formule du composé
 * @returns {Promise<number>} - Compound ID (CID)
 */
async function getCIDFromName(searchTerm) {
    const encodedSearch = encodeURIComponent(searchTerm);
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodedSearch}/cids/JSON`;
    
    try {
		console.log('🔍 Tentative de fetch:', url);

		const response = await fetch(url, {
		    method: 'GET',
		    headers: {
		        'Accept': 'application/json'
		    }
		});

		console.log('✅ Réponse reçue, status:', response.status);
        if (!response.ok) {
            throw new Error(`Composé "${searchTerm}" non trouvé sur PubChem`);
        }
        const data = await response.json();
        const cid = data.IdentifierList.CID[0];
        console.log(`✅ CID trouvé pour "${searchTerm}": ${cid}`);
        return cid;
    } catch (error) {
        throw new Error(`Erreur lors de la recherche: ${error.message}`);
    }
}

/**
 * Télécharge la structure 3D au format SDF depuis PubChem
 * @param {number} cid - Compound ID
 * @returns {Promise<string>} - Contenu du fichier SDF
 */
async function downloadSDF(cid) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
    
    try {
		console.log('📥 Téléchargement SDF:', url);

		const response = await fetch(url, {
		    method: 'GET',
		    headers: {
		        'Accept': 'text/plain'
		    }
		});

		console.log('✅ SDF reçu, status:', response.status);
        if (!response.ok) {
            throw new Error(`Pas de structure 3D disponible pour le CID ${cid}`);
        }
        const sdfContent = await response.text();
        console.log(`✅ Structure 3D téléchargée (${sdfContent.length} caractères)`);
        return sdfContent;
    } catch (error) {
        throw new Error(`Erreur téléchargement SDF: ${error.message}`);
    }
}

/**
 * Parse un fichier SDF et extrait les atomes et liaisons
 * @param {string} sdfContent - Contenu du fichier SDF
 * @returns {Object} - {atoms: [{element, x, y, z}], bonds: [{atom1, atom2, type}]}
 */
function parseSDFFile(sdfContent) {
    const lines = sdfContent.split('\n');
    
    // Trouve la ligne du "Counts line" (format: aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv)
    let countsLineIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        // Le Counts line contient le nombre d'atomes et de liaisons (format: XXX XXX ...)
        if (line.match(/^\s*\d+\s+\d+/)) {
            countsLineIndex = i;
            break;
        }
    }
    
    if (countsLineIndex === -1) {
        throw new Error('Format SDF invalide: Counts line non trouvée');
    }
    
    const countsLine = lines[countsLineIndex].trim().split(/\s+/);
    const numAtoms = parseInt(countsLine[0]);
    const numBonds = parseInt(countsLine[1]);
    
    console.log(`📊 Structure: ${numAtoms} atomes, ${numBonds} liaisons`);
    
    // Parse les atomes (après le Counts line)
    const atoms = [];
    for (let i = 0; i < numAtoms; i++) {
        const line = lines[countsLineIndex + 1 + i].trim();
        const parts = line.split(/\s+/);
        
        if (parts.length < 4) continue;
        
        atoms.push({
            element: parts[3],
            x: parseFloat(parts[0]),
            y: parseFloat(parts[1]),
            z: parseFloat(parts[2])
        });
    }
    
    // Parse les liaisons (après les atomes)
    const bonds = [];
    for (let i = 0; i < numBonds; i++) {
        const line = lines[countsLineIndex + 1 + numAtoms + i].trim();
        const parts = line.split(/\s+/);
        
        if (parts.length < 3) continue;
        
        bonds.push({
            atom1: parseInt(parts[0]) - 1, // Index commence à 0
            atom2: parseInt(parts[1]) - 1,
            type: parseInt(parts[2]) // 1=simple, 2=double, 3=triple
        });
    }
    
    return { atoms, bonds };
}

/**
 * Crée une scène Three.js avec la molécule
 * @param {Object} moleculeData - {atoms, bonds}
 * @returns {THREE.Scene} - Scène Three.js
 */
function createMoleculeScene(moleculeData) {
    const { atoms, bonds } = moleculeData;
    const scene = new THREE.Scene();
    
    // Calcul du centre de la molécule pour la centrer
    let centerX = 0, centerY = 0, centerZ = 0;
    atoms.forEach(atom => {
        centerX += atom.x;
        centerY += atom.y;
        centerZ += atom.z;
    });
    centerX /= atoms.length;
    centerY /= atoms.length;
    centerZ /= atoms.length;
    
    // Création des sphères pour les atomes
    const atomMeshes = [];
    atoms.forEach((atom, index) => {
        const radius = (ATOM_RADII[atom.element] || ATOM_RADII.default) * 0.3; // Échelle
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const color = ATOM_COLORS[atom.element] || ATOM_COLORS.default;
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            metalness: 0.3,
            roughness: 0.5
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            atom.x - centerX,
            atom.y - centerY,
            atom.z - centerZ
        );
        
        // Ajout d'un userData pour identification
        mesh.userData = {
            type: 'atom',
            element: atom.element,
            index: index
        };
        
        scene.add(mesh);
        atomMeshes.push(mesh);
    });
    
    // Création des cylindres pour les liaisons
    bonds.forEach(bond => {
        const atom1 = atoms[bond.atom1];
        const atom2 = atoms[bond.atom2];
        
        const start = new THREE.Vector3(
            atom1.x - centerX,
            atom1.y - centerY,
            atom1.z - centerZ
        );
        const end = new THREE.Vector3(
            atom2.x - centerX,
            atom2.y - centerY,
            atom2.z - centerZ
        );
        
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        
        // Épaisseur selon le type de liaison
        const radiusScale = {
            1: 0.15,  // Simple
            2: 0.12,  // Double (2 cylindres parallèles)
            3: 0.10   // Triple (3 cylindres parallèles)
        };
        const bondRadius = radiusScale[bond.type] || 0.15;
        
        if (bond.type === 1) {
            // Liaison simple
            const bondMesh = createBondCylinder(start, end, bondRadius, 0xCCCCCC);
            scene.add(bondMesh);
        } else if (bond.type === 2) {
            // Liaison double (2 cylindres parallèles)
            const offset = direction.clone().normalize().cross(new THREE.Vector3(0, 1, 0)).multiplyScalar(0.1);
            const bond1 = createBondCylinder(
                start.clone().add(offset), 
                end.clone().add(offset), 
                bondRadius, 
                0xCCCCCC
            );
            const bond2 = createBondCylinder(
                start.clone().sub(offset), 
                end.clone().sub(offset), 
                bondRadius, 
                0xCCCCCC
            );
            scene.add(bond1, bond2);
        } else if (bond.type === 3) {
            // Liaison triple (3 cylindres)
            const offset = direction.clone().normalize().cross(new THREE.Vector3(0, 1, 0)).multiplyScalar(0.15);
            const bond1 = createBondCylinder(start, end, bondRadius, 0xCCCCCC);
            const bond2 = createBondCylinder(
                start.clone().add(offset), 
                end.clone().add(offset), 
                bondRadius, 
                0xCCCCCC
            );
            const bond3 = createBondCylinder(
                start.clone().sub(offset), 
                end.clone().sub(offset), 
                bondRadius, 
                0xCCCCCC
            );
            scene.add(bond1, bond2, bond3);
        }
    });
    
    console.log(`✅ Scène 3D créée: ${atoms.length} atomes, ${bonds.length} liaisons`);
    return scene;
}

/**
 * Crée un cylindre pour représenter une liaison
 * @param {THREE.Vector3} start 
 * @param {THREE.Vector3} end 
 * @param {number} radius 
 * @param {number} color 
 * @returns {THREE.Mesh}
 */
function createBondCylinder(start, end, radius, color) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 16);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        metalness: 0.2,
        roughness: 0.6
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position au milieu de la liaison
    mesh.position.copy(start).add(direction.multiplyScalar(0.5));
    
    // Orientation du cylindre
    const axis = new THREE.Vector3(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
    
    mesh.userData = { type: 'bond' };
    
    return mesh;
}

/**
 * Exporte une scène Three.js en GLB
 * @param {THREE.Scene} scene 
 * @returns {Promise<Blob>} - Blob du fichier GLB
 */
function exportSceneToGLB(scene) {
    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        
        exporter.parse(
            scene,
            (gltf) => {
                const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                console.log(`✅ GLB exporté (${blob.size} octets)`);
                resolve(blob);
            },
            (error) => {
                reject(new Error(`Erreur export GLB: ${error}`));
            },
            { binary: true }
        );
    });
}

/**
 * Fonction principale : Génère un modèle 3D GLB à partir d'un nom de molécule
 * @param {string} moleculeName - Nom ou formule du composé
 * @returns {Promise<Object>} - {url, name, cid, numAtoms, numBonds}
 */
export async function generateMoleculeGLB(moleculeName) {
    try {
        console.log(`🔬 Génération du modèle 3D pour "${moleculeName}"...`);
        
		// 1. Recherche du CID
		const cid = await getCIDFromName(moleculeName);

		// Délai anti-rate-limit
		await new Promise(resolve => setTimeout(resolve, 200));

		// 2. Téléchargement du SDF
		const sdfContent = await downloadSDF(cid);
        
        // 3. Parse du SDF
        const moleculeData = parseSDFFile(sdfContent);
        
        // 4. Création de la scène 3D
        const scene = createMoleculeScene(moleculeData);
        
        // 5. Export en GLB
        const glbBlob = await exportSceneToGLB(scene);
        
        // 6. Création d'une URL blob
        const glbUrl = URL.createObjectURL(glbBlob);
        
        console.log(`✅ Modèle 3D généré avec succès: ${glbUrl}`);
        
        return {
            url: glbUrl,
            name: moleculeName,
            cid: cid,
            numAtoms: moleculeData.atoms.length,
            numBonds: moleculeData.bonds.length
        };
        
    } catch (error) {
        console.error(`❌ Erreur génération 3D: ${error.message}`);
        throw error;
    }
}

/**
 * Libère une URL blob de la mémoire
 * @param {string} url - URL blob à libérer
 */
export function releaseGLBUrl(url) {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        console.log('🗑️ URL blob libérée');
    }
}

/**
 * Version batch : Génère plusieurs molécules en parallèle
 * @param {string[]} moleculeNames - Liste de noms de molécules
 * @param {Function} progressCallback - Callback pour suivre la progression
 * @returns {Promise<Object[]>} - Liste des résultats
 */
export async function generateMoleculesGLBBatch(moleculeNames, progressCallback = null) {
    const results = [];
    
    for (let i = 0; i < moleculeNames.length; i++) {
        const name = moleculeNames[i];
        
        try {
            const result = await generateMoleculeGLB(name);
            results.push({ success: true, name, ...result });
            
            if (progressCallback) {
                progressCallback(i + 1, moleculeNames.length, name, null);
            }
        } catch (error) {
            results.push({ success: false, name, error: error.message });
            
            if (progressCallback) {
                progressCallback(i + 1, moleculeNames.length, name, error.message);
            }
        }
    }
    
    return results;
}