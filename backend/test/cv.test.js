const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-test-'));
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.SQLITE_PATH = path.join(directory, 'cv.db');
process.env.ADMIN_EMAIL = 'test@example.test';
process.env.ADMIN_PASSWORD = randomBytes(24).toString('hex');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
const db = require('../db');
const app = require('../server');
const source = require('../data.json');
let server, origin, token, original, editedBackup;

before(async () => {
    await db.ready;
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
});

async function request(url, method = 'GET', body, authorized = true) {
    return fetch(origin + url, { method, headers: { ...(authorized && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('initialisation complète depuis data.json et accès public', async () => {
    original = await (await request('/api/cv')).json();
    assert.equal(original.profil, source.profil);
    assert.equal(original.infos.nom, source.infos.nom);
    assert.deepEqual(original.competences, source.competences);
    assert.equal(original.experiences.length, 7);
    assert.equal(original.experiences.flatMap(exp => exp.projets || []).length, 9);
    assert.deepEqual(original.experiences.map(exp => exp.missions), source.experiences.map(exp => exp.missions || []));
    assert.deepEqual(original.experiences.flatMap(exp => (exp.projets || []).map(p => [p.equipe, p.role])),
        source.experiences.flatMap(exp => (exp.projets || []).map(p => [p.equipe || '', p.role || ''])));
    assert.equal((await request('/health')).status, 200);
});

test('authentification et protection des sauvegardes', async () => {
    assert.equal((await request('/api/admin/export', 'GET', null, false)).status, 401);
    const bad = await request('/api/admin/login', 'POST', { email: process.env.ADMIN_EMAIL, password: 'incorrect' });
    assert.equal(bad.status, 401);
    const response = await request('/api/admin/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    assert.equal(response.status, 200);
    token = (await response.json()).token;
    assert.ok(token);
});

test('modification du CV, sauvegarde JSON et comptes préservés', async () => {
    const users = await db.all('SELECT * FROM users');
    const response = await request('/api/admin/cv', 'PUT', { profil: original.profil + '\nTexte de test.' });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.profil, original.profil + '\nTexte de test.');
    assert.deepEqual(data.experiences, original.experiences);
    assert.deepEqual(await db.all('SELECT * FROM users'), users);
    const backups = await (await request('/api/admin/backups')).json();
    assert.equal(backups.length, 3);
    editedBackup = backups[0].id;
    const exported = await (await request('/api/admin/export')).json();
    assert.deepEqual(exported, data);
    assert.equal(JSON.stringify(exported).includes('password_hash'), false);
});

test('expérience avec sous-projet : création, modification et suppression', async () => {
    const exp = { poste: 'Poste test', entreprise: 'Société test', periode: '2026', missions: ['Mission'],
        technologies: ['Java'], projets: [{ titre: 'Projet test', equipe: 'Équipe test', role: 'Développeur test',
            missions: ['Sous-mission'], technologies: ['Angular'] }] };
    const created = await request('/api/admin/experiences', 'POST', exp);
    assert.equal(created.status, 201);
    const id = (await created.json()).id;
    const current = await (await request(`/api/admin/experiences/${id}`)).json();
    assert.deepEqual(current.projets[0].missions, ['Sous-mission']);
    assert.equal(current.projets[0].equipe, 'Équipe test');
    assert.equal(current.projets[0].role, 'Développeur test');
    assert.equal((await request(`/api/admin/experiences/${id}`, 'PUT', { ...current, poste: 'Poste modifié' })).status, 200);
    assert.equal((await (await request(`/api/admin/experiences/${id}`)).json()).projets[0].role, 'Développeur test');
    assert.equal((await (await request(`/api/admin/experiences/${id}`)).json()).projets[0].id, current.projets[0].id);
    assert.equal((await request(`/api/admin/experiences/${id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/api/admin/experiences/${id}`)).status, 404);
    assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
});

test('validation et rollback : aucune modification partielle', async () => {
    const before = await (await request('/api/cv')).json();
    const history = await db.get('SELECT COUNT(*) AS total FROM cv_backups');
    assert.equal((await request('/api/admin/cv', 'PUT', { profil: 42 })).status, 400);
    assert.deepEqual(await (await request('/api/cv')).json(), before);
    assert.deepEqual(await db.get('SELECT COUNT(*) AS total FROM cv_backups'), history);
    await assert.rejects(db.transaction(async tx => {
        await tx.execute("UPDATE profil SET contenu = 'Ne doit pas être conservé' WHERE id = 1");
        await tx.execute("INSERT INTO experiences (id, poste, entreprise, periode) VALUES (1, 'x', 'x', 'x')");
    }));
    assert.deepEqual(await (await request('/api/cv')).json(), before);
});

test('restauration récupérable et modèle PDF inchangé', async () => {
    const result = await request(`/api/admin/backups/${editedBackup}/restore`, 'POST');
    assert.equal(result.status, 200);
    assert.equal((await result.json()).profil, original.profil + '\nTexte de test.');
    const first = await (await request('/api/admin/backups/1')).json();
    assert.equal(first.profil, source.profil);
    const restored = await request('/api/admin/backups/1/restore', 'POST');
    assert.equal(restored.status, 200);
    const html = await require('../pdf.service').renderHtml();
    assert.ok(html.includes('Angular 21'));
    assert.ok(html.includes('AEFE'));
});
