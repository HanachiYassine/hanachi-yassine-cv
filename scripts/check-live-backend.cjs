const assert = require('node:assert/strict');
const { setTimeout: pause } = require('node:timers/promises');
const { validateCv } = require('../backend/cv-validation');

async function request(config, path, timeout = 20000) {
    const response = await fetch(new URL(path, config.api), {
        headers: { Origin: config.origin }, signal: AbortSignal.timeout(timeout), redirect: 'error'
    });
    assert.ok(response.ok, `${path} répond HTTP ${response.status}.`);
    return response;
}

async function waitForCommit(config) {
    const deadline = Date.now() + (config.maxWaitMs ?? 1200000);
    do {
        try {
            const health = await (await request(config, '/health')).json();
            if (health.status === 'ok' && health.commit === config.commit) return;
        } catch { /* Le service peut être indisponible pendant sa construction ou son réveil. */ }
        process.stdout.write('En attente du commit vérifié sur le backend…\n');
        await pause(config.intervalMs ?? 10000);
    } while (Date.now() < deadline);
    throw new Error('Le backend n’a pas démarré le commit vérifié dans le délai imparti.');
}

function checkCors(response, config) {
    assert.equal(response.headers.get('access-control-allow-origin'), config.origin,
        'Le navigateur ne peut pas accéder à l’API : vérifier CORS_ORIGINS.');
}

async function checkCv(config) {
    const response = await request(config, '/api/cv');
    checkCors(response, config);
    const cv = validateCv(await response.json());
    const projects = cv.experiences.flatMap(exp => exp.projets || []).length;
    assert.equal(cv.experiences.length, 7, 'Le CV publié doit contenir les sept expériences.');
    assert.equal(projects, 9, 'Le CV publié doit contenir les neuf sous-projets.');
    console.log(`CV chargé : ${cv.experiences.length} expériences et ${projects} sous-projets.`);
}

async function checkFrontend(config) {
    const deployed = await (await request(config, '/deployment.json')).json();
    assert.equal(deployed.commit, config.commit, 'Le frontend doit être publié avec le même commit que l’API.');
    const html = await (await request(config, '/')).text();
    assert.ok(/<app-root[\s>]/i.test(html) && /<base\s+href=["']\/["']/i.test(html),
        'Le frontend Angular doit être compilé pour la racine Netlify.');
    console.log('Frontend Angular publié avec le même commit que l’API.');
}

async function checkPdf(config) {
    const response = await request(config, '/api/pdf', 120000);
    checkCors(response, config);
    assert.ok(response.headers.get('content-type')?.includes('application/pdf'), 'Le serveur ne renvoie pas un PDF.');
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.ok(pdf.length > 1000 && pdf.subarray(0, 5).toString() === '%PDF-', 'Le PDF reçu est vide ou invalide.');
    console.log('PDF généré et accessible depuis le site du CV.');
}

async function runChecks(config) {
    assert.ok(config.api && config.commit && config.origin, 'Adresse API, commit et origine du site requis.');
    await waitForCommit(config);
    await checkFrontend(config);
    await checkCv(config);
    await checkPdf(config);
}

if (require.main === module) {
    runChecks({ api: process.env.PUBLIC_API_URL, commit: process.env.GITHUB_SHA,
        origin: process.env.PUBLIC_SITE_ORIGIN || process.env.PUBLIC_API_URL })
        .catch(error => { console.error(`::error::${error.message}`); process.exitCode = 1; });
}

module.exports = { waitForCommit, checkFrontend, checkCv, checkPdf, runChecks };
