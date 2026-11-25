const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createClient } = require('@libsql/client');
const { cvStatements } = require('../cv-serialization');
const { getCvData } = require('../cv.service');
const { prepareCareerUpdate } = require('../career-update');
const { applyCareerUpdate } = require('../career-update-store');
const source = require('../data.json');

async function fixture(t) {
    const client = createClient({ url: ':memory:' });
    t.after(() => client.close());
    await client.executeMultiple(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
    await client.execute('PRAGMA foreign_keys = ON');
    const data = structuredClone(source);
    data.experiences.shift();
    data.experiences[0].periode = '05/2024 – Actuel';
    data.experiences.push({ poste: 'Poste conservé', entreprise: 'Ajout en ligne', periode: '2020' });
    await client.batch(cvStatements(data), 'write');
    await client.execute("INSERT INTO users (email, password_hash) VALUES ('test@example.test', 'hash-test')");
    return { client, before: await getCvData(client) };
}

test('préparation : clôture SNCF, ajoute France Travail, conserve les autres rubriques et IDs', async t => {
    const { before } = await fixture(t);
    const after = prepareCareerUpdate(before);
    assert.equal(after.experiences.length, before.experiences.length + 1);
    assert.equal(after.experiences[0].periode, '21/11/2026 – Actuel');
    assert.equal(after.experiences[1].id, before.experiences[0].id);
    assert.equal(after.experiences[1].periode, '05/2024 – 13/11/2026');
    assert.deepEqual(after.experiences.slice(2), require('../cv-validation').validateCv(before).experiences.slice(1));
    assert.deepEqual(before.experiences[0].periode, '05/2024 – Actuel');
    assert.deepEqual(prepareCareerUpdate(after), after);
});

async function table(client, name) {
    return (await client.execute(`SELECT * FROM ${name} ORDER BY id`)).rows.map(row => ({ ...row }));
}

test('application transactionnelle : comptes et sous-projets intacts, sauvegardes, idempotence', async t => {
    const { client, before } = await fixture(t);
    const preserved = await table(client, 'experience_projets');
    const users = await table(client, 'users');
    const after = prepareCareerUpdate(before);
    assert.equal(await applyCareerUpdate(client, before, after), true);
    assert.deepEqual(await table(client, 'experience_projets'), preserved);
    assert.deepEqual(await table(client, 'users'), users);
    assert.equal((await table(client, 'cv_backups')).length, 2);
    const current = await getCvData(client);
    assert.equal(await applyCareerUpdate(client, current, prepareCareerUpdate(current)), false);
    assert.equal((await table(client, 'cv_backups')).length, 2);
});

test('refuse une modification concurrente après l’export sans écriture partielle', async t => {
    const { client, before } = await fixture(t);
    await client.execute("UPDATE profil SET contenu = 'Modification concurrente' WHERE id = 1");
    const current = await getCvData(client);
    await assert.rejects(applyCareerUpdate(client, before, prepareCareerUpdate(before)), /base a changé/);
    assert.deepEqual(await getCvData(client), current);
    assert.equal((await table(client, 'cv_backups')).length, 0);
});

test('rollback intégral si l’insertion France Travail échoue après les premières écritures', async t => {
    const { client, before } = await fixture(t);
    await client.executeMultiple(`CREATE TRIGGER fail_ft BEFORE INSERT ON experiences
        WHEN NEW.entreprise = 'FRANCE TRAVAIL' BEGIN SELECT RAISE(ABORT, 'échec simulé'); END;`);
    await assert.rejects(applyCareerUpdate(client, before, prepareCareerUpdate(before)), /échec simulé/);
    assert.deepEqual(await getCvData(client), before);
    assert.equal((await table(client, 'cv_backups')).length, 0);
});

test('refuse une expérience France Travail divergente et un rapprochement SNCF ambigu', async t => {
    const { before } = await fixture(t);
    const after = prepareCareerUpdate(before);
    after.experiences[0].missions.push('Saisie en ligne à examiner');
    after.experiences[0].entreprise = 'France Travail';
    assert.throws(() => prepareCareerUpdate(after), /rapprochement manuel/);
    before.experiences.push({ ...before.experiences[0], id: 100 });
    assert.throws(() => prepareCareerUpdate(before), /ambiguë/);
});

test('refuse un JSON initial sans IDs et un correctif relu différent du code', async t => {
    assert.throws(() => prepareCareerUpdate(source), /identifiants/);
    const { client, before } = await fixture(t);
    const after = prepareCareerUpdate(before);
    after.experiences.pop();
    await assert.rejects(applyCareerUpdate(client, before, after), /version du code/);
    assert.deepEqual(await getCvData(client), before);
});

test('la commande de préparation fonctionne hors ligne même sans configuration SQL valide', async t => {
    const { before } = await fixture(t);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-career-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const input = path.join(directory, 'before.json');
    const output = path.join(directory, 'after.json');
    fs.writeFileSync(input, JSON.stringify(before));
    const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/update-career.js'),
        '--input', input, '--output', output], { encoding: 'utf8',
        env: { ...process.env, DATABASE_PROVIDER: 'invalide', TURSO_DATABASE_URL: 'invalide' } });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), prepareCareerUpdate(before));
});
