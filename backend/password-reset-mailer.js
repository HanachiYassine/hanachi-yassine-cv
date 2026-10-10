const { randomUUID } = require('node:crypto');
const logger = require('./logger');

class ResendError extends Error {
    constructor(status) {
        super('Resend HTTP ' + status);
        this.name = 'ResendError';
    }
}

function unavailable() {
    return Object.assign(new Error('L’envoi d’e-mail est indisponible. Réessayez plus tard.'), { status: 503 });
}

function configurationError(attemptId, reason, details) {
    logger.error('Resend - configuration invalide ' + JSON.stringify({ attemptId, ...details }), new Error(reason));
    throw unavailable();
}

function configuredOrigin(attemptId) {
    const source = ['ADMIN_APP_URL', 'PUBLIC_API_URL', 'URL'].find(name => process.env[name]);
    let url;
    try { url = new URL(source ? process.env[source] : 'http://localhost:3000'); }
    catch { configurationError(attemptId, 'Adresse de l’administration invalide', { parameter: source || 'origin' }); }
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && process.env.NODE_ENV !== 'production';
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
        configurationError(attemptId, 'Adresse de l’administration non autorisée', { parameter: source || 'origin' });
    }
    return { origin: url.origin, source: source || 'localhost' };
}

function configuration() {
    const attemptId = randomUUID();
    const missing = ['RESEND_API_KEY', 'ADMIN_EMAIL'].filter(name => !process.env[name]);
    if (missing.length) configurationError(attemptId, 'Variables e-mail manquantes', { missing });
    const { origin, source } = configuredOrigin(attemptId);
    logger.info('Resend - configuration chargée', { attemptId, originSource: source, apiKeyConfigured: true });
    return { key: process.env.RESEND_API_KEY, email: process.env.ADMIN_EMAIL, origin,
        from: process.env.RESET_EMAIL_FROM || 'CV Admin <onboarding@resend.dev>', attemptId };
}

function redact(text, config) {
    const secrets = [config.key, process.env.ADMIN_PASSWORD, process.env.JWT_SECRET, process.env.TURSO_AUTH_TOKEN];
    const cleaned = secrets.filter(value => typeof value === 'string' && value.length)
        .reduce((value, secret) => value.split(secret).join('[MASQUÉ]'), text);
    return cleaned.replace(/(#token=)[^\s"'<>]+/gi, '$1[MASQUÉ]')
        .replace(/\b[a-f0-9]{64}\b/gi, '[MASQUÉ]')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[MASQUÉ]')
        .replace(/\bre_[A-Za-z0-9_-]+/g, '[MASQUÉ]')
        .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [MASQUÉ]');
}

function safeValue(value, config) {
    if (typeof value === 'string') return redact(value, config);
    if (Array.isArray(value)) return value.map(item => safeValue(item, config));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeValue(item, config)]));
    return value;
}

function logRequest(config, payload) {
    logger.info('Resend - requête', { attemptId: config.attemptId, method: 'POST', url: 'https://api.resend.com/emails',
        headers: { Authorization: 'Bearer [MASQUÉ]', 'Content-Type': 'application/json', 'Idempotency-Key': '[MASQUÉ]' },
        body: safeValue(payload, config) });
}

function requestEmail(config, payload, id) {
    return fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json', 'Idempotency-Key': id },
        body: JSON.stringify(payload)
    });
}

function responseDetails(body, config) {
    return Object.fromEntries(['id', 'name', 'message'].filter(field => typeof body?.[field] === 'string')
        .map(field => [field, redact(body[field], config).slice(0, 2000)]));
}

async function logResponse(response, config) {
    let body;
    try { body = responseDetails(await response.json(), config); }
    catch {
        body = { name: 'unreadable_response', message: 'Réponse Resend non JSON ou illisible' };
        logger.error('Resend - réponse illisible ' + JSON.stringify({ attemptId: config.attemptId, status: response.status }), new Error(body.message));
    }
    logger.info('Resend - réponse', { attemptId: config.attemptId, status: response.status, ok: response.ok, body });
}

function transportError(failure) {
    const kind = ['TimeoutError', 'AbortError', 'TypeError'].includes(failure?.name) ? failure.name : 'Erreur réseau';
    const codes = ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'];
    const code = codes.includes(failure?.cause?.code) ? ' (' + failure.cause.code + ')' : '';
    return new Error(kind + code);
}

async function deliver(configuration, to, subject, text, id) {
    const config = { ...configuration, attemptId: configuration.attemptId || randomUUID() };
    const payload = { from: config.from, to: [to], subject, text };
    logRequest(config, payload);
    try {
        const response = await requestEmail(config, payload, id);
        await logResponse(response, config);
        if (!response.ok) throw new ResendError(response.status);
    } catch (failure) {
        const provider = failure instanceof ResendError;
        logger.error('Resend - ' + (provider ? 'refus HTTP' : 'erreur réseau') + ' ' + JSON.stringify({ attemptId: config.attemptId }),
            provider ? failure : transportError(failure));
        throw unavailable();
    }
}

function sendLink(config, user, token, digest) {
    const url = config.origin + '/admin/reset-password.html#token=' + token;
    const text = 'Un lien de récupération a été demandé pour votre administration CV.\n\n' + url +
        '\n\nCe lien expire dans 15 minutes et ne peut être utilisé qu’une fois. ' +
        'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.';
    return deliver(config, user.email, 'Réinitialiser le mot de passe de votre CV', text, 'cv-reset/' + digest);
}

async function sendConfirmation(config, email, digest) {
    try {
        await deliver(config, email, 'Mot de passe de votre CV modifié',
            'Votre mot de passe administrateur a été modifié. Les sessions précédentes ont été déconnectées.\n' +
            'Si vous n’êtes pas à l’origine de cette modification, demandez immédiatement un nouveau lien de récupération.',
            'cv-reset-confirmed/' + digest);
    } catch (failure) {
        logger.error('Mot de passe modifié, notification non envoyée', failure);
    }
}

module.exports = { configuration, sendLink, sendConfirmation };
