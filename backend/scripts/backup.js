const fs = require('fs/promises');
const path = require('path');
const db = require('../db');
const { getCvData } = require('../cv.service');

async function backup() {
    const index = process.argv.indexOf('--output');
    const file = index >= 0 ? process.argv[index + 1] : `backups/data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    if (!file) throw new Error('Fichier de sortie manquant.');
    const data = await getCvData();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    console.log(`Sauvegarde créée : ${file}`);
}

backup().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
