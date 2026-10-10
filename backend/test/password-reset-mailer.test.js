const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const logger = require('../logger');
const mailer = require('../password-reset-mailer');
const originalFetch = global.fetch;
const originalInfo = logger.info;
const originalError = logger.error;
const savedEnvironment = { ...process.env };
const token = 'a'.repeat(64);
const digest = 'b'.repeat(64);
const config = { key: 're_test_private_key', email: 'admin@example.test', from: 'CV Admin <onboarding@resend.dev>',
    origin: 'https://cv.example.test', attemptId: 'test-attempt' };
const logs = [];
let sent;

function record(message, details) {
    logs.push({ message, details: details instanceof Error ? details.message : details });
}

function mockResponse(body, status = 200) {
    global.fetch = async (url, options) => {
        sent = { url, headers: options.headers, body: JSON.parse(options.body) };
        return new Response(JSON.stringify(body), { status });
    };
}

function entries(message) {
    return logs.filter(entry => entry.message === message);
}

function assertSecretsHidden(secrets) {
    const captured = JSON.stringify(logs);
    for (const secret of secrets) assert.equal(captured.includes(secret), false, 'Un secret apparaît dans les logs');
}

function assertSentMail() {
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.headers.Authorization, 'Bearer ' + config.key);
    assert.equal(sent.headers['Idempotency-Key'], 'cv-reset/' + digest);
    assert.ok(sent.body.text.includes('#token=' + token));
}

function assertPayloadLogs(request, response) {
    assert.deepEqual(request.body.to, [config.email]);
    assert.equal(request.body.from, config.from);
    assert.equal(request.body.subject, sent.body.subject);
    assert.ok(request.body.text.includes('#token=[MASQUÉ]'));
    assert.deepEqual(response, { attemptId: config.attemptId, status: 200, ok: true, body: { id: 'mail-id' } });
    assert.equal(request.attemptId, response.attemptId);
}

beforeEach(() => {
    logs.length = 0;
    sent = undefined;
    logger.info = record;
    logger.error = record;
    process.env.RESEND_API_KEY = config.key;
    process.env.ADMIN_EMAIL = config.email;
    process.env.ADMIN_APP_URL = config.origin;
    process.env.ADMIN_PASSWORD = 'admin-private-password';
    process.env.JWT_SECRET = 'private-jwt-signing-secret';
    process.env.TURSO_AUTH_TOKEN = 'private-turso-token';
    mockResponse({ id: 'mail-id' });
});

after(() => {
    global.fetch = originalFetch;
    logger.info = originalInfo;
    logger.error = originalError;
    for (const name of Object.keys(process.env)) if (!(name in savedEnvironment)) delete process.env[name];
    Object.assign(process.env, savedEnvironment);
});

test('les logs distinguent le payload et la réponse sans modifier le vrai mail', async () => {
    await mailer.sendLink(config, { email: config.email }, token, digest);
    const request = entries('Resend - requête')[0].details;
    const response = entries('Resend - réponse')[0].details;
    assertSentMail();
    assertPayloadLogs(request, response);
    assertSecretsHidden([token, digest, config.key]);
});

test('le refus HTTP conserve le détail Resend nettoyé et le statut public 503', async () => {
    mockResponse({ name: 'validation_error', message: "Invalid 'from' field", Authorization: config.key }, 400);
    await assert.rejects(mailer.sendLink(config, { email: config.email }, token, digest), failure => failure.status === 503);
    assert.deepEqual(entries('Resend - réponse')[0].details.body, { name: 'validation_error', message: "Invalid 'from' field" });
    assert.equal(entries('Resend - réponse')[0].details.status, 400);
    assert.ok(logs.some(entry => entry.message.startsWith('Resend - refus HTTP') && entry.details === 'Resend HTTP 400'));
    assert.equal(logs.some(entry => entry.message.startsWith('Resend - erreur réseau')), false);
    assertSecretsHidden([token, config.key]);
});

test('un fournisseur qui reflète des credentials ne les expose jamais dans la réponse journalisée', async () => {
    const secrets = [config.key, token, digest, process.env.ADMIN_PASSWORD, process.env.JWT_SECRET, process.env.TURSO_AUTH_TOKEN];
    mockResponse({ name: 'validation_error', message: secrets.join(' ') + ' https://cv.example.test/#token=' + token }, 400);
    await assert.rejects(mailer.sendLink(config, { email: config.email }, token, digest));
    assertSecretsHidden(secrets);
    assert.ok(entries('Resend - réponse')[0].details.body.message.includes('[MASQUÉ]'));
});

test('les erreurs réseau et délais sont distincts des réponses HTTP sans refléter leur message brut', async () => {
    global.fetch = async () => { throw Object.assign(new Error(config.key + token), { name: 'TimeoutError', cause: { code: 'ETIMEDOUT' } }); };
    await assert.rejects(mailer.sendLink(config, { email: config.email }, token, digest), failure => failure.status === 503);
    assert.equal(entries('Resend - réponse').length, 0);
    assert.ok(logs.some(entry => entry.message.startsWith('Resend - erreur réseau') && entry.details === 'TimeoutError (ETIMEDOUT)'));
    assert.equal(logs.some(entry => entry.message.startsWith('Resend - refus HTTP')), false);
    assertSecretsHidden([config.key, token]);
});

test('une réponse non JSON reste un refus HTTP identifiable et ne fuite pas son contenu brut', async () => {
    global.fetch = async () => new Response(config.key + token, { status: 400 });
    await assert.rejects(mailer.sendLink(config, { email: config.email }, token, digest), failure => failure.status === 503);
    assert.equal(entries('Resend - réponse')[0].details.body.name, 'unreadable_response');
    assert.ok(logs.some(entry => entry.message.startsWith('Resend - réponse illisible')));
    assert.ok(logs.some(entry => entry.message.startsWith('Resend - refus HTTP')));
    assertSecretsHidden([config.key, token]);
});

test('les variables manquantes sont nommées sans afficher de valeurs ni appeler Resend', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
    assert.throws(() => mailer.configuration(), failure => failure.status === 503);
    assert.ok(logs.some(entry => entry.message.includes('RESEND_API_KEY') && entry.message.includes('ADMIN_EMAIL')));
    assert.equal(sent, undefined);
    assertSecretsHidden([config.key, token]);
});

test('une adresse de récupération invalide est signalée sans exposer son contenu', () => {
    process.env.ADMIN_APP_URL = 'https://user:' + config.key + '@example.test';
    assert.throws(() => mailer.configuration(), failure => failure.status === 503);
    assert.ok(logs.some(entry => entry.message.includes('ADMIN_APP_URL') && entry.details.includes('non autorisée')));
    assert.equal(sent, undefined);
    assertSecretsHidden([config.key]);
});

test('la configuration valide et le mail partagent un identifiant de tentative', async () => {
    const loaded = mailer.configuration();
    await mailer.sendLink(loaded, { email: config.email }, token, digest);
    const id = entries('Resend - configuration chargée')[0].details.attemptId;
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.equal(entries('Resend - requête')[0].details.attemptId, id);
    assert.equal(entries('Resend - réponse')[0].details.attemptId, id);
    assertSecretsHidden([config.key, token]);
});
