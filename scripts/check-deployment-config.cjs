const fs = require('fs');

function apiError(value) {
    if (!value) return 'Variable Actions PUBLIC_API_URL manquante : renseigner l’origine HTTPS du backend Netlify.';
    try {
        const url = new URL(value);
        const local = /^(localhost|127\..*|0\.0\.0\.0|\[::1\])$/.test(url.hostname);
        const placeholder = /\.(invalid|localhost|test)$/.test(url.hostname);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
            url.pathname !== '/' || local || placeholder) throw new Error('URL invalide');
        return null;
    } catch {
        return 'PUBLIC_API_URL doit contenir une origine HTTPS publique effective, sans /api ni identifiants.';
    }
}

function configurationErrors(env) {
    return [apiError(env.PUBLIC_API_URL)].filter(Boolean);
}

function deploymentSummary(errors) {
    return errors.length ? [
        '## Déploiement bloqué : configuration incomplète', '',
        ...errors.map(error => `- ${error}`), '',
        'Activer également Settings → Pages → Source → GitHub Actions.',
        'Les compilations et tests peuvent réussir sans publier le site.',
        'Configurer le backend Netlify Free et Turso, puis relancer le workflow complet sur main.', ''
    ] : ['## Configuration de déploiement présente', '',
        'La publication attend encore les contrôles backend/frontend et les réglages GitHub Pages.', ''];
}

function checkConfiguration() {
    const errors = configurationErrors(process.env);
    if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, deploymentSummary(errors).join('\n'));
    }
    for (const error of errors) process.stderr.write(`::error::${error}\n`);
    process.exitCode = errors.length ? 1 : 0;
}

if (require.main === module) checkConfiguration();
module.exports = { apiError, configurationErrors };
