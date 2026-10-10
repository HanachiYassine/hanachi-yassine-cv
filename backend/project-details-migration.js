const source = require('./data.json');
const { insert } = require('./cv-serialization');
const { getCvData } = require('./cv.service');

function detailStatements() {
    return source.experiences.flatMap(exp => (exp.projets || []).map(project => ({
        sql: `UPDATE experience_projets SET equipe = COALESCE(equipe, ?), role = COALESCE(role, ?)
            WHERE titre = ? AND COALESCE(contexte, '') = ? AND experience_id IN
            (SELECT id FROM experiences WHERE poste = ? AND entreprise = ? AND periode = ?)`,
        args: [project.equipe || '', project.role || '', project.titre, project.contexte || '', exp.poste, exp.entreprise, exp.periode]
    })));
}

function backup(data, phase) {
    return insert('cv_backups', { reason: `migration-sous-projets:${phase}`, data_json: JSON.stringify(data) });
}

async function applyDetails(tx, missing) {
    const before = await getCvData(tx);
    const statements = [...missing.map(key => ({ sql: `ALTER TABLE experience_projets ADD COLUMN ${key} TEXT`, args: [] })),
        ...detailStatements()];
    if (before.infos) statements.unshift(backup(before, 'avant'));
    await tx.batch(statements);
    if (before.infos) await tx.batch([backup(await getCvData(tx), 'après')]);
}

async function migrateProjectDetails(client) {
    const columns = (await client.execute('PRAGMA table_info(experience_projets)')).rows.map(row => row.name);
    const missing = ['equipe', 'role'].filter(key => !columns.includes(key));
    if (!missing.length) return;
    const tx = await client.transaction('write');
    try {
        await applyDetails(tx, missing);
        await tx.commit();
    } catch (error) {
        await tx.rollback();
        throw error;
    } finally { tx.close(); }
}

module.exports = { migrateProjectDetails };
