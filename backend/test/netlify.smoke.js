const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-netlify-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.SQLITE_PATH = path.join(directory, 'cv.db');
process.env.ADMIN_EMAIL = 'test@example.test';
process.env.ADMIN_PASSWORD = randomBytes(24).toString('hex');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.CORS_ORIGINS = 'https://hanachiyassine.github.io';
process.env.COMMIT_REF = process.env.CV_TEST_COMMIT || 'c'.repeat(40);
delete process.env.RESEND_API_KEY;
const bundle = process.env.CV_TEST_BUNDLE;
if (!bundle) require('../netlify/build.cjs').prepareBuild();
const { handler } = require(bundle ? path.join(bundle, 'api.js') : '../netlify/functions/api');
const db = require(bundle ? path.join(bundle, 'backend/db') : '../db');
after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });

function request(url, method = 'GET', body, origin = process.env.CORS_ORIGINS) {
    return handler({ path: url, rawUrl: `https://cv.example.test${url}`, httpMethod: method,
        headers: { origin, 'content-type': 'application/json' }, queryStringParameters: {},
        requestContext: { identity: { sourceIp: '127.0.0.1' } },
        body: body ? JSON.stringify(body) : null, isBase64Encoded: false }, {});
}

test('le handler Lambda annonce le commit embarqué et charge le CV complet', async () => {
    const health = await request('/health');
    assert.equal(health.statusCode, 200);
    assert.equal(JSON.parse(health.body).commit, process.env.COMMIT_REF);
    const response = await request('/api/cv');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['access-control-allow-origin'], process.env.CORS_ORIGINS);
    const cv = JSON.parse(response.body);
    assert.equal(cv.experiences.length, 7);
    assert.equal(cv.experiences.flatMap(exp => exp.projets || []).length, 9);
});

test('préflight Pages autorisé, origine inconnue refusée et administration protégée', async () => {
    const allowed = await request('/api/cv', 'OPTIONS');
    assert.equal(allowed.statusCode, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], process.env.CORS_ORIGINS);
    const denied = await request('/api/cv', 'GET', null, 'https://autre.example');
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    assert.equal((await request('/api/admin/export')).statusCode, 401);
    const login = await request('/api/admin/login', 'POST', {
        email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    assert.equal(login.statusCode, 200);
    assert.ok(JSON.parse(login.body).token);
    assert.ok(fs.existsSync(path.join(__dirname, '../netlify/public/admin/index.html')));
});

test('un vrai PDF Chromium est transporté en binaire par Lambda, y compris au second appel', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await request('/api/pdf');
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.isBase64Encoded, true);
        assert.ok(response.headers['content-type'].includes('application/pdf'));
        assert.equal(response.headers['access-control-allow-origin'], process.env.CORS_ORIGINS);
        const pdf = Buffer.from(response.body, 'base64');
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        assert.ok(pdf.length > 10000 && pdf.length < 4500000);
    }
});

test('la récupération reste fermée sans fournisseur de mail, dans le handler et le paquet Netlify', async () => {
    const response = await request('/api/admin/forgot-password', 'POST', {});
    assert.equal(response.statusCode, 503);
    assert.equal(JSON.stringify(response).includes('token='), false);
    assert.equal((await request('/api/admin/reset-password', 'POST', { token: 'invalide' })).statusCode, 400);
    assert.ok(fs.existsSync(path.join(__dirname, '../netlify/public/admin/reset-password.html')));
});

async function completeRecovery(resetToken) {
    const password = randomBytes(24).toString('hex');
    const body = { token: resetToken, password, confirmation: password };
    assert.equal((await request('/api/admin/reset-password', 'POST', body)).statusCode, 200);
    assert.equal((await request('/api/admin/reset-password', 'POST', body)).statusCode, 400);
    const login = await request('/api/admin/login', 'POST', { email: process.env.ADMIN_EMAIL, password });
    assert.equal(login.statusCode, 200);
    const old = await request('/api/admin/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    assert.equal(old.statusCode, 401);
}

test('le parcours mail et changement fonctionne aussi depuis le paquet Lambda', async context => {
    let mail;
    context.mock.method(global, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.resend.com/emails');
        mail = JSON.parse(options.body);
        return new Response(JSON.stringify({ id: 'test-mail' }), { status: 200 });
    });
    process.env.RESEND_API_KEY = 'unit-test-mail-key';
    process.env.ADMIN_APP_URL = 'https://cv.example.test';
    try {
        assert.equal((await request('/api/admin/forgot-password', 'POST', {})).statusCode, 202);
        await completeRecovery(new URL(mail.text.match(/https:\/\/\S+/)[0]).hash.slice('#token='.length));
    } finally { delete process.env.RESEND_API_KEY; }
});
