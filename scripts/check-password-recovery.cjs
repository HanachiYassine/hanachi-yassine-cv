const assert = require('node:assert/strict');

async function readPage(site, path) {
    const response = await fetch(new URL(path, site), { redirect: 'error', signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, path + ' doit être publié.');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer', 'La page admin doit protéger le lien de récupération.');
    return response.text();
}

async function checkRecovery(site) {
    assert.ok(site, 'PUBLIC_API_URL est requis.');
    const [login, reset, script, style] = await Promise.all([
        readPage(site, '/admin/'), readPage(site, '/admin/reset-password.html'),
        readPage(site, '/admin/password-recovery.js'), readPage(site, '/admin/password-recovery.css')
    ]);
    assert.ok(login.includes('id="forgotPasswordButton"') && login.includes('./password-recovery.js'));
    assert.ok(reset.includes('id="resetPasswordForm"') && reset.includes('autocomplete="new-password"'));
    assert.ok(reset.includes('Content-Security-Policy') && reset.includes('no-referrer'));
    assert.ok(script.includes('forgot-password') && script.includes('reset-password'));
    assert.ok(style.includes('.recovery'));
    process.stdout.write('Pages et ressources de récupération administrateur publiées ; protection du référent vérifiée.\n');
}

if (require.main === module) checkRecovery(process.env.PUBLIC_API_URL).catch(failure => {
    process.stderr.write(failure.message + '\n');
    process.exitCode = 1;
});

module.exports = { checkRecovery };
