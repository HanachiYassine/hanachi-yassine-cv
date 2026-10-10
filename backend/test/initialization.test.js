const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@libsql/client');
const { initialize } = require('../initialize-db');
const { getCvData } = require('../cv.service');
const fs = require('node:fs');
const path = require('node:path');
const source = require('../data.json');
const { cvStatements } = require('../cv-serialization');

async function legacyClient(partial = false) {
    const client = createClient({ url: ':memory:' });
    await client.executeMultiple(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
    await client.batch(cvStatements(source), 'write');
    await client.execute('ALTER TABLE experience_projets DROP COLUMN role');
    if (partial) await client.execute("UPDATE experience_projets SET equipe = 'Équipe personnalisée' WHERE id = 1");
    else await client.execute('ALTER TABLE experience_projets DROP COLUMN equipe');
    return client;
}

test('ancien schéma : équipes et rôles récupérés, sauvegardes et modifications conservées', async () => {
    const client = await legacyClient();
    try {
        await initialize(client, 'turso');
        const projects = (await getCvData(client)).experiences.flatMap(exp => exp.projets || []);
        assert.deepEqual(projects.map(p => [p.equipe, p.role]), source.experiences.flatMap(exp => (exp.projets || []).map(p => [p.equipe || '', p.role || ''])));
        assert.equal((await client.execute('SELECT COUNT(*) AS total FROM cv_backups')).rows[0].total, 2);
        await client.execute("UPDATE experience_projets SET role = 'Rôle personnalisé' WHERE id = 1");
        await initialize(client, 'turso');
        assert.equal((await client.execute('SELECT role FROM experience_projets WHERE id = 1')).rows[0].role, 'Rôle personnalisé');
        assert.equal((await client.execute('SELECT COUNT(*) AS total FROM cv_backups')).rows[0].total, 2);
    } finally { client.close(); }
});

test('migration partielle : une équipe déjà renseignée reste intacte', async () => {
    const client = await legacyClient(true);
    try {
        await initialize(client, 'turso');
        const first = (await getCvData(client)).experiences.flatMap(exp => exp.projets || [])[0];
        assert.equal(first.equipe, 'Équipe personnalisée');
        assert.equal(first.role, source.experiences.flatMap(exp => exp.projets || [])[0].role);
    } finally { client.close(); }
});

test('initialisation Turso : aucun écrasement au redémarrage, données et sauvegardes conservées', async () => {
    const client = createClient({ url: ':memory:' });
    try {
        await initialize(client, 'turso');
        const data = await getCvData(client);
        assert.equal(data.experiences.length, 7);
        await client.execute("UPDATE profil SET contenu = 'Profil modifié en ligne' WHERE id = 1");
        await initialize(client, 'turso');
        assert.equal((await getCvData(client)).profil, 'Profil modifié en ligne');
        assert.equal((await client.execute('SELECT COUNT(*) AS total FROM cv_backups')).rows[0].total, 1);
    } finally { client.close(); }
});
