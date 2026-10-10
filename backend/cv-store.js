const db = require('./db');
const { getCvData } = require('./cv.service');
const { validateCv } = require('./cv-validation');
const { insert, cvStatements, clearStatements } = require('./cv-serialization');
let writes = Promise.resolve();

function backupStatement(data, reason) {
    return insert('cv_backups', { reason, data_json: JSON.stringify(data) });
}

async function editInTransaction(tx, reason, edit) {
    const before = await getCvData(tx);
    const next = validateCv(await edit(structuredClone(before)));
    await tx.batch([backupStatement(before, `avant : ${reason}`), ...clearStatements, ...cvStatements(next)]);
    const after = await getCvData(tx);
    await tx.batch([backupStatement(after, reason)]);
    return after;
}

function editCv(reason, edit) {
    const operation = writes.then(() => db.transaction(tx => editInTransaction(tx, reason, edit)));
    writes = operation.catch(() => {});
    return operation;
}

async function restoreBackup(id) {
    const backup = await db.get('SELECT data_json FROM cv_backups WHERE id = ?', [id]);
    if (!backup) { const error = new Error('Sauvegarde introuvable.'); error.status = 404; throw error; }
    return editCv(`restauration ${id}`, () => JSON.parse(backup.data_json));
}

module.exports = { editCv, restoreBackup };
