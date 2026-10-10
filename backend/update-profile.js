const db = require('./db');
const { editCv } = require('./cv-store');
const { profil } = require('./data.json');
editCv('mise à jour du profil depuis data.json', current => ({ ...current, profil }))
    .then(() => console.log('Profil mis à jour et sauvegardé.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => db.close());
