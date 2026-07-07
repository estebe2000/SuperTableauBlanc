import fs from 'fs';
import path from 'path';

const DISCIPLINES_PAR_CYCLE = {
    cycle1: ['Maternelle'],
    cycle2: ['Français', 'Mathématiques', 'Anglais', 'Questionner le monde', 'EMC', 'Éducation Musicale', 'Arts Plastiques', 'EPS'],
    cycle3: ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'Sciences et technologie', 'EMC', 'Arts Plastiques', 'Éducation Musicale', 'EPS'],
    cycle4: ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'Technologie', 'EMC', 'Arts Plastiques', 'Éducation Musicale', 'EPS'],
    'lycee-gt': ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'SES', 'Philosophie', 'NSI', 'SNT'],
    'lycee-pro': ['Français', 'Mathématiques', 'Histoire-Géographie', 'PSE', 'Économie-Gestion', 'Anglais']
};

function getSlug(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const baseDir = 'public/programmes';
const report = [];

for (const [cycle, disciplines] of Object.entries(DISCIPLINES_PAR_CYCLE)) {
    for (const discipline of disciplines) {
        const discSlug = getSlug(discipline);
        let filename = `${cycle}-${discSlug}.json`;
        if (cycle === 'cycle1') filename = 'cycle1-maternelle.json';
        if (cycle === 'cycle2') filename = 'cycle2.json';
        
        const filePath = path.join(baseDir, filename);
        if (!fs.existsSync(filePath)) {
            // Try searching for a file that contains the cycle and some part of the discipline name
            const allFiles = fs.readdirSync(baseDir);
            const possibleMatches = allFiles.filter(f => f.startsWith(cycle) && f.endsWith('.json'));
            
            report.push({
                cycle,
                discipline,
                expected: filename,
                status: 'MISSING',
                availableForCycle: possibleMatches
            });
        } else {
            // Check if it's valid JSON
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                JSON.parse(content);
                report.push({
                    cycle,
                    discipline,
                    expected: filename,
                    status: 'OK'
                });
            } catch (e) {
                report.push({
                    cycle,
                    discipline,
                    expected: filename,
                    status: 'INVALID_JSON',
                    error: e.message
                });
            }
        }
    }
}

console.log(JSON.stringify(report, null, 2));
