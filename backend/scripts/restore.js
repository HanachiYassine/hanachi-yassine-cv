const fs = require('fs/promises');
const db = require('../db');
const { editCv } = require('../cv-store');

async function restore() {
    const file = process.argv[2];
    if (!file) throw new Error('Utilisation : npm run restore -- chemin/vers/data.json');
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    await editCv('restauration fichier JSON', () => data);
    console.log('CV restauré ; le contenu précédent est conservé dans les sauvegardes.');
}

restore().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
