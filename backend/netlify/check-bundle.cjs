const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const extract = require('extract-zip');

async function checkBundle() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-netlify-bundle-'));
    try {
        await extract(path.resolve('.netlify/functions/api.zip'), { dir: directory });
        const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--test', 'test/netlify.smoke.js'], {
            stdio: 'inherit', env: { ...process.env, CV_TEST_BUNDLE: directory,
                CV_TEST_COMMIT: process.env.COMMIT_REF || process.env.GITHUB_SHA } });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error('Les contrôles du paquet Netlify ont échoué.');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

checkBundle().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
