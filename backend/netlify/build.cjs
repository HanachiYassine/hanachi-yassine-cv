const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function prepareBuild() {
    const commit = process.env.COMMIT_REF || process.env.GITHUB_SHA;
    if (!/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('COMMIT_REF ou GITHUB_SHA doit contenir le commit déployé.');
    const publish = path.join(__dirname, 'public');
    fs.mkdirSync(publish, { recursive: true });
    fs.cpSync(path.join(__dirname, '../public/admin'), path.join(publish, 'admin'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'commit.json'), JSON.stringify({ commit }) + '\n');
    fs.writeFileSync(path.join(publish, 'deployment.json'), JSON.stringify({ commit }) + '\n');
}

function buildSite() {
    const root = path.resolve(__dirname, '../..');
    const env = { ...process.env, CYPRESS_INSTALL_BINARY: '0',
        PUBLIC_API_URL: process.env.PUBLIC_API_URL || process.env.URL };
    function run(command, args) {
        const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`La compilation a échoué : ${command}`);
    }
    run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund']);
    run(process.execPath, ['scripts/configure-frontend.cjs']);
    // Angular 16 utilise Node 18 ; Express et Chromium restent sur Node 22.
    run('npx', ['--yes', '--package=node@18.20.8', '--', 'node',
        'node_modules/@angular/cli/bin/ng.js', 'build', '--configuration', 'production', '--base-href', '/']);
    const publish = path.join(__dirname, 'public');
    fs.rmSync(publish, { recursive: true, force: true });
    fs.cpSync(path.join(root, 'dist/angular-quickstart'), publish, { recursive: true });
    prepareBuild();
}

if (require.main === module) buildSite();
module.exports = { prepareBuild };
