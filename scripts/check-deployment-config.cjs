const fs = require('fs');

function apiError(value) {
    if (!value) return 'Variable Actions PUBLIC_API_URL manquante : renseigner l’origine HTTPS du backend Render.';
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

function hookError(value) {
    if (!value) return 'Secret Actions RENDER_DEPLOY_HOOK_URL manquant : copier le Deploy Hook du service Render.';
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'api.render.com' ||
            !url.pathname.startsWith('/deploy/') || !url.searchParams.get('key')) throw new Error('URL invalide');
        return null;
    } catch {
        return 'RENDER_DEPLOY_HOOK_URL doit être un Deploy Hook HTTPS Render valide ; sa valeur ne doit pas être publiée.';
    }
}

const errors = [apiError(process.env.PUBLIC_API_URL), hookError(process.env.RENDER_DEPLOY_HOOK_URL)].filter(Boolean);
const summary = errors.length ? [
    '## Déploiement bloqué : configuration incomplète', '',
    ...errors.map(error => `- ${error}`), '',
    'Activer également Settings → Pages → Source → GitHub Actions.',
    'Les compilations et tests peuvent réussir sans publier le site.',
    'Configurer le backend Render et Turso, puis relancer le workflow sur main.', ''
] : ['## Configuration de déploiement présente', '',
    'La publication attend encore les contrôles backend/frontend et les réglages GitHub Pages.', ''];
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n'));
for (const error of errors) console.error(`::error::${error}`);
process.exitCode = errors.length ? 1 : 0;
