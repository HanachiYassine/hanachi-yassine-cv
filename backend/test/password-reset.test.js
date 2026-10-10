const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-recovery-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.SQLITE_PATH = path.join(directory, 'cv.db');
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = randomBytes(24).toString('hex');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.RESEND_API_KEY = 'unit-test-mail-key';
process.env.ADMIN_APP_URL = 'https://cv.example.test';
const db = require('../db');
const app = require('../server');
const originalFetch = global.fetch;
const mails = [];
let server, origin, initialHash, mailStatus = 200, failConfirmation = false;

function mailResponse(url, options) {
    if (url !== 'https://api.resend.com/emails') return originalFetch(url, options);
    const body = JSON.parse(options.body);
    mails.push({ body, headers: options.headers });
    const status = failConfirmation && body.subject.includes('modifié') ? 503 : mailStatus;
    return Promise.resolve(new Response(JSON.stringify({ id: 'test-mail' }), { status }));
}

before(async () => {
    await db.ready;
    initialHash = (await db.get('SELECT password_hash FROM users WHERE id = 1')).password_hash;
    global.fetch = mailResponse;
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
});

beforeEach(async () => {
    process.env.RESEND_API_KEY = 'unit-test-mail-key';
    process.env.ADMIN_APP_URL = 'https://cv.example.test';
    mailStatus = 200;
    failConfirmation = false;
    mails.length = 0;
    await db.run('DELETE FROM password_reset_tokens');
    await db.run('DELETE FROM password_reset_limits');
    await db.run('DELETE FROM user_auth_state');
    await db.run('UPDATE users SET password_hash = ? WHERE id = 1', [initialHash]);
});

after(async () => {
    global.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
});

function request(pathname, body = {}, token) {
    return originalFetch(origin + '/api/admin/' + pathname, {
        method: token ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(token ? {} : { body: JSON.stringify(body) })
    });
}

function passwordBody(token, password = randomBytes(24).toString('hex')) {
    return { token, password, confirmation: password };
}

async function issueLink() {
    const response = await request('forgot-password');
    assert.equal(response.status, 202);
    const message = mails.at(-1).body.text;
    const link = message.match(/https:\/\/\S+/)[0];
    return new URL(link).hash.slice('#token='.length);
}

async function loginToken(password = process.env.ADMIN_PASSWORD) {
    const response = await request('login', { email: process.env.ADMIN_EMAIL, password });
    assert.equal(response.status, 200);
    return (await response.json()).token;
}

test('la configuration manquante échoue sans prétendre envoyer un mail', async () => {
    delete process.env.RESEND_API_KEY;
    assert.equal((await request('forgot-password')).status, 503);
    assert.equal(mails.length, 0);
    assert.equal((await db.all('SELECT * FROM password_reset_tokens')).length, 0);
});

test('le mail vise le compte configuré et le jeton ne fuite pas dans la réponse ou la base', async () => {
    const response = await request('forgot-password', { email: 'attacker@example.test', origin: 'https://attacker.example' });
    assert.equal(response.status, 202);
    const raw = new URL(mails[0].body.text.match(/https:\/\/\S+/)[0]).hash.slice('#token='.length);
    const stored = await db.get('SELECT * FROM password_reset_tokens');
    assert.equal(stored.token_hash, createHash('sha256').update(raw).digest('hex'));
    assert.ok(stored.expires_at > Date.now() && stored.expires_at <= Date.now() + 15 * 60 * 1000);
    assert.deepEqual(mails[0].body.to, [process.env.ADMIN_EMAIL]);
    assert.ok(mails[0].body.text.includes('https://cv.example.test/admin/reset-password.html#token='));
    assert.equal(JSON.stringify(await response.json()).includes(raw), false);
    assert.equal(mails[0].headers.Authorization, 'Bearer unit-test-mail-key');
    assert.ok(mails[0].headers['Idempotency-Key'].startsWith('cv-reset/'));
});

test('aucun compte ne donne la même réponse sans transmettre un mail à un autre destinataire', async () => {
    process.env.ADMIN_EMAIL = 'absent@example.test';
    try {
        const response = await request('forgot-password');
        assert.equal(response.status, 202);
        assert.ok((await response.json()).message.startsWith('Si le compte administrateur'));
        assert.equal(mails.length, 0);
    } finally { process.env.ADMIN_EMAIL = 'admin@example.test'; }
});

test('jeton invalide, mot de passe court, confirmation et limite bcrypt sont vérifiés', async () => {
    const token = await issueLink();
    assert.equal((await request('reset-password', passwordBody('invalid'))).status, 400);
    assert.equal((await request('reset-password', passwordBody(token, 'court'))).status, 400);
    assert.equal((await request('reset-password', { ...passwordBody(token), confirmation: 'différent' })).status, 400);
    assert.equal((await request('reset-password', passwordBody(token, 'é'.repeat(37)))).status, 400);
    assert.equal((await db.all('SELECT * FROM password_reset_tokens')).length, 1);
});

test('un lien expiré ne modifie pas le compte', async () => {
    const token = await issueLink();
    await db.run('UPDATE password_reset_tokens SET expires_at = ?', [Date.now() - 1]);
    assert.equal((await request('reset-password', passwordBody(token))).status, 400);
    assert.equal((await db.get('SELECT password_hash FROM users WHERE id = 1')).password_hash, initialHash);
});

async function existingSession() {
    const token = jwt.sign({ id: 1, email: process.env.ADMIN_EMAIL }, process.env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await request('export', {}, token)).status, 200);
    return token;
}

async function assertSessionsChanged(newPassword, oldSession) {
    assert.equal((await request('export', {}, oldSession)).status, 403);
    assert.equal((await request('login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).status, 401);
    const newSession = await loginToken(newPassword);
    assert.equal((await request('export', {}, newSession)).status, 200);
}

test('le changement est atomique, révoque tous les liens et sessions, puis permet la nouvelle connexion', async () => {
    const oldSession = await existingSession();
    const token = await issueLink();
    const otherToken = await issueLink();
    const body = passwordBody(token);
    assert.equal((await request('reset-password', body)).status, 200);
    assert.ok(await bcrypt.compare(body.password, (await db.get('SELECT password_hash FROM users WHERE id = 1')).password_hash));
    await assertSessionsChanged(body.password, oldSession);
    assert.equal((await request('reset-password', body)).status, 400);
    assert.equal((await request('reset-password', passwordBody(otherToken))).status, 400);
    assert.equal((await db.all('SELECT * FROM password_reset_tokens')).length, 0);
    assert.ok(mails.at(-1).body.subject.includes('modifié'));
    assert.equal(mails.at(-1).body.text.includes(body.password), false);
});

test('deux utilisations concurrentes du même lien donnent un seul succès', async () => {
    const body = passwordBody(await issueLink());
    const responses = await Promise.all([request('reset-password', body), request('reset-password', body)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
    assert.equal((await db.get('SELECT version FROM user_auth_state WHERE user_id = 1')).version, 1);
});

test('la limite de demandes est partagée en base et survit au rechargement du service', async () => {
    await issueLink();
    await issueLink();
    await issueLink();
    delete require.cache[require.resolve('../password-reset.service')];
    await assert.rejects(require('../password-reset.service').requestReset('another-instance'), failure => failure.status === 429);
    assert.equal(mails.length, 3);
});

test('un refus du fournisseur supprime le jeton et conserve le mot de passe', async () => {
    mailStatus = 403;
    assert.equal((await request('forgot-password')).status, 503);
    assert.equal((await db.all('SELECT * FROM password_reset_tokens')).length, 0);
    assert.equal((await db.get('SELECT password_hash FROM users WHERE id = 1')).password_hash, initialHash);
});

test('la panne de notification après changement ne présente pas le mot de passe modifié comme un échec', async () => {
    const body = passwordBody(await issueLink());
    failConfirmation = true;
    assert.equal((await request('reset-password', body)).status, 200);
    await loginToken(body.password);
});

test('une requête de formulaire simple ne déclenche pas de mail', async () => {
    const response = await originalFetch(origin + '/api/admin/forgot-password', { method: 'POST', body: 'request' });
    assert.equal(response.status, 415);
    assert.equal(mails.length, 0);
});
