const assert = require('node:assert/strict');
const { getCvData } = require('./cv.service');
const { validateCv } = require('./cv-validation');
const { insert, expKeys } = require('./cv-serialization');
const { prepareCareerUpdate } = require('./career-update');

function leaves(exp) {
    return [...exp.missions.map(mission => insert('experience_missions', { experience_id: exp.id, mission })),
        ...exp.technologies.map(techno => insert('experience_technos', { experience_id: exp.id, techno }))];
}

function sncfStatements(exp) {
    return [{ sql: `UPDATE experiences SET ${expKeys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`,
        args: [...expKeys.map(key => exp[key]), exp.id] },
    { sql: 'DELETE FROM experience_missions WHERE experience_id = ?', args: [exp.id] },
    { sql: 'DELETE FROM experience_technos WHERE experience_id = ?', args: [exp.id] }, ...leaves(exp)];
}

function contentStatements(before, after) {
    const sncf = after.experiences.find(exp => exp.entreprise === 'SNCF RÉSEAU');
    const statements = [...sncfStatements(sncf),
        { sql: 'UPDATE infos SET titre = ?, adresse = ? WHERE id = 1', args: [after.infos.titre, after.infos.adresse] },
        { sql: 'UPDATE profil SET contenu = ? WHERE id = 1', args: [after.profil] }];
    for (const item of after.competences.langagesFrameworks) {
        if (!(before.competences.langagesFrameworks || []).includes(item)) {
            statements.push(insert('competences', { categorie: 'langagesFrameworks', item }));
        }
    }
    return statements;
}

async function insertFranceTravail(tx, before, after) {
    const exp = after.experiences.find(row => row.entreprise === 'FRANCE TRAVAIL');
    if (before.experiences.some(row => row.id === exp.id)) return;
    const order = await tx.execute('SELECT MIN(ordre) AS first FROM experiences');
    await tx.batch([insert('experiences', { id: exp.id, ordre: Number(order.rows[0].first) - 1,
        ...Object.fromEntries(expKeys.map(key => [key, exp[key]])) }), ...leaves(exp)]);
}

function backup(data, reason) {
    return insert('cv_backups', { reason, data_json: JSON.stringify(data) });
}

async function updateTransaction(tx, before, after) {
    const current = validateCv(await getCvData(tx));
    assert.deepEqual(current, before, 'La base a changé depuis l’export : refaire la préparation.');
    if (JSON.stringify(current) === JSON.stringify(after)) return false;
    await tx.batch([backup(await getCvData(tx), 'avant : carrière 2026-11'), ...contentStatements(before, after)]);
    await insertFranceTravail(tx, before, after);
    const saved = await getCvData(tx);
    assert.deepEqual(validateCv(saved), after, 'Résultat différent du correctif relu.');
    assert.equal((await tx.execute('PRAGMA foreign_key_check')).rows.length, 0, 'Relations SQL invalides.');
    await tx.batch([backup(saved, 'carrière 2026-11')]);
    return true;
}

async function applyCareerUpdate(client, previous, reviewed) {
    const before = validateCv(previous);
    const after = validateCv(reviewed);
    assert.deepEqual(after, prepareCareerUpdate(before), 'Le correctif relu ne correspond pas à cette version du code.');
    const tx = await client.transaction('write');
    try {
        const changed = await updateTransaction(tx, before, after);
        await tx.commit();
        return changed;
    } catch (error) {
        await tx.rollback();
        throw error;
    } finally { tx.close(); }
}

module.exports = { applyCareerUpdate };
