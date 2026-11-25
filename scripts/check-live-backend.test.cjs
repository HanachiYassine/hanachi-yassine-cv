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
    if (req.url === '/deployment.json') return res.end(JSON.stringify({ commit: state.frontendCommit }));
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(state.html); }
    res.statusCode = state.pdfStatus;
    res.end(state.pdf);
}

async function fixture(t, overrides = {}) {
    const state = { requests: [], healthCalls: 0, commits: ['ancien', 'nouveau'], cors: origin,
        cv, frontendCommit: 'nouveau', html: '<base href="/"><app-root></app-root>',
        pdf: '%PDF-1.4\n' + 'x'.repeat(1100), pdfStatus: 200, ...overrides };
    const server = http.createServer((req, res) => respond(state, req, res));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return { state, config: { api: `http://127.0.0.1:${server.address().port}`, origin,
        commit: 'nouveau', intervalMs: 1, maxWaitMs: 1000 } };
}

test('attend le nouveau commit puis vérifie Angular, le CV et le PDF', async t => {
    const { state, config } = await fixture(t);
    await runChecks(config);
    assert.deepEqual(state.requests.map(req => req.path), ['/health', '/health', '/deployment.json', '/', '/api/cv', '/api/pdf']);
    assert.ok(state.requests.every(req => req.origin === origin));
});

test('un ancien backend sain ne suffit pas à autoriser la publication', async t => {
    const { state, config } = await fixture(t, { commits: ['ancien'] });
    await assert.rejects(runChecks({ ...config, maxWaitMs: 1 }), /commit vérifié/);
    assert.ok(state.requests.every(req => req.path === '/health'));
});

const failures = [
    ['frontend d’un ancien commit', { frontendCommit: 'ancien' }, /même commit/],
    ['frontend compilé pour un sous-chemin', { html: '<base href="/cv/"><app-root></app-root>' }, /racine Netlify/],
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

test('accepte une expérience et un sous-projet supplémentaires sans borne fixe', async t => {
    const expanded = structuredClone(cv);
    expanded.experiences.push({ poste: 'Développeur', entreprise: 'Autre mission', periode: '2027',
        projets: [{ titre: 'Nouveau sous-projet', missions: ['Conception'], technologies: ['Java'] }] });
    const { config } = await fixture(t, { cv: expanded });
    await runChecks(config);
});

const contentFailures = [
    ['expérience historique absente', data => data.experiences.pop(), /Expérience manquante/],
    ['sous-projet historique absent', data => data.experiences.find(exp => exp.projets)?.projets.pop(), /Sous-projet manquant/],
    ['ancienne période SNCF', data => { data.experiences[1].periode = '05/2024 – Actuel'; }, /période incorrecte/],
    ['France Travail absent', data => data.experiences.shift(), /FRANCE TRAVAIL/],
    ['mission perdue', data => data.experiences[1].missions.shift(), /Mission manquant/],
    ['technologie perdue', data => data.experiences[0].technologies.pop(), /Technologie manquant/],
    ['expérience dupliquée', data => data.experiences.push(data.experiences[0]), /dupliquées/]
];
for (const [name, edit, message] of contentFailures) {
    test(`bloque un CV valide mais incomplet : ${name}`, async t => {
        const data = structuredClone(cv);
        edit(data);
        const { config } = await fixture(t, { cv: data });
        await assert.rejects(runChecks(config), message);
    });
}
