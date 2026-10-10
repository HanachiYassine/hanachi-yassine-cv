const test = require('node:test');
const assert = require('node:assert/strict');
const { apiError, configurationErrors } = require('./check-deployment-config.cjs');
const configured = { PUBLIC_API_URL: 'https://cv-api.netlify.app' };

test('une origine HTTPS effective suffit sans jeton Netlify supplémentaire', () => {
    assert.deepEqual(configurationErrors(configured), []);
    assert.equal(apiError(configured.PUBLIC_API_URL), null);
});

test('une origine absente est signalée sans exposer de valeurs', () => {
    const errors = configurationErrors({});
    assert.equal(errors.length, 1);
    assert.ok(errors.some(error => error.includes('PUBLIC_API_URL')));
});

test('les URL locales, exemples, identifiants et chemins sont refusés', () => {
    for (const url of ['http://cv-api.netlify.app', 'https://localhost', 'https://example.invalid',
        'https://user:password@cv-api.netlify.app', 'https://cv-api.netlify.app/api',
        'https://cv-api.netlify.app?key=secret']) assert.ok(apiError(url));
});
