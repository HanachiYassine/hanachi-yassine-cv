const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { runChecks } = require('./check-live-backend.cjs');
const cv = require('../backend/data.json');
const origin = 'https://hanachiyassine.github.io';

function respond(state, req, res) {
    state.requests.push({ path: req.url, origin: req.headers.origin });
    res.setHeader('Access-Control-Allow-Origin', state.cors);
    res.setHeader('Content-Type', req.url === '/api/pdf' ? 'application/pdf' : 'application/json');
    if (req.url === '/health') {
        const commit = state.commits[Math.min(state.healthCalls++, state.commits.length - 1)];
        return res.end(JSON.stringify({ status: 'ok', commit }));
    }
    if (req.url === '/api/cv') return res.end(JSON.stringify(state.cv));
    res.statusCode = state.pdfStatus;
    res.end(state.pdf);
}

async function fixture(t, overrides = {}) {
    const state = { requests: [], healthCalls: 0, commits: ['ancien', 'nouveau'], cors: origin,
        cv, pdf: '%PDF-1.4\n' + 'x'.repeat(1100), pdfStatus: 200, ...overrides };
    const server = http.createServer((req, res) => respond(state, req, res));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return { state, config: { api: `http://127.0.0.1:${server.address().port}`, origin,
        commit: 'nouveau', intervalMs: 1, maxWaitMs: 1000 } };
}

test('attend le nouveau commit puis charge le CV et le PDF avec l’origine Pages', async t => {
    const { state, config } = await fixture(t);
    await runChecks(config);
    assert.deepEqual(state.requests.map(req => req.path), ['/health', '/health', '/api/cv', '/api/pdf']);
    assert.ok(state.requests.every(req => req.origin === origin));
});

test('un ancien backend sain ne suffit pas à autoriser la publication', async t => {
    const { state, config } = await fixture(t, { commits: ['ancien'] });
    await assert.rejects(runChecks({ ...config, maxWaitMs: 1 }), /commit vérifié/);
    assert.ok(state.requests.every(req => req.path === '/health'));
});

const failures = [
    ['CV incomplet', { cv: {} }, /Objet invalide/],
    ['CORS incompatible avec le navigateur', { cors: 'https://autre.example' }, /CORS_ORIGINS/],
    ['PDF vide ou invalide', { pdf: 'réponse sans PDF' }, /PDF reçu/],
    ['échec de génération PDF', { pdfStatus: 500 }, /HTTP 500/]
];
for (const [name, overrides, message] of failures) {
    test(`bloque la publication : ${name}`, async t => {
        const { config } = await fixture(t, { commits: ['nouveau'], ...overrides });
        await assert.rejects(runChecks(config), message);
    });
}
