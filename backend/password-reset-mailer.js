const logger = require('./logger');

function unavailable() {
    return Object.assign(new Error('L’envoi d’e-mail est indisponible. Réessayez plus tard.'), { status: 503 });
}

function configuration() {
    const key = process.env.RESEND_API_KEY;
    const email = process.env.ADMIN_EMAIL;
    let url;
    try { url = new URL(process.env.ADMIN_APP_URL || process.env.PUBLIC_API_URL || process.env.URL || 'http://localhost:3000'); }
    catch { throw unavailable(); }
    if (!key || !email || url.username || url.password || url.search || url.hash) throw unavailable();
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && process.env.NODE_ENV !== 'production';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw unavailable();
    return { key, email, origin: url.origin, from: process.env.RESET_EMAIL_FROM || 'CV Admin <onboarding@resend.dev>' };
}

async function deliver(config, to, subject, text, id) {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST', signal: AbortSignal.timeout(10000),
            headers: { Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json', 'Idempotency-Key': id },
            body: JSON.stringify({ from: config.from, to: [to], subject, text })
        });
        if (!response.ok) throw new Error('Resend HTTP ' + response.status);
    } catch (failure) {
        logger.error('Échec de l’envoi du mail de récupération', new Error(failure.name === 'Error' && /^Resend HTTP \d+$/.test(failure.message) ? failure.message : 'Échec du transport e-mail'));
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
