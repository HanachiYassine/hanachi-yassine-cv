const db = require('./db');
const { editCv } = require('./cv-store');
function update(current) {
    for (const exp of current.experiences) {
        for (const row of [exp, ...(exp.projets || [])]) {
            row.technologies = (row.technologies || []).map(value => value === 'TS' ? 'TypeScript' : value);
        }
    }
    return current;
}
editCv('normalisation TypeScript', update)
    .then(() => console.log('Technologies mises à jour et sauvegardées.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => db.close());
