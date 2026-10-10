const fs = require('fs');
const apiBaseUrl = process.env.PUBLIC_API_URL;
if (!apiBaseUrl) throw new Error('Définir PUBLIC_API_URL avec l’adresse HTTPS du backend.');
const url = new URL(apiBaseUrl);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('PUBLIC_API_URL doit être une URL HTTPS publique sans identifiants.');
}
const origin = url.origin;
fs.writeFileSync('src/environments/environment.prod.ts',
    `export const environment = { production: true, apiBaseUrl: ${JSON.stringify(origin)} };\n`);
console.log('Configuration de l’API de production générée.');
