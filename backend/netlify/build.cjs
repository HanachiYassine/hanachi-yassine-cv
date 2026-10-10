const fs = require('node:fs');
const path = require('node:path');

function prepareBuild() {
    const commit = process.env.COMMIT_REF || process.env.GITHUB_SHA;
    if (!/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('COMMIT_REF ou GITHUB_SHA doit contenir le commit déployé.');
    const publish = path.join(__dirname, 'public');
    fs.mkdirSync(publish, { recursive: true });
    fs.cpSync(path.join(__dirname, '../public/admin'), path.join(publish, 'admin'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'commit.json'), JSON.stringify({ commit }) + '\n');
}

if (require.main === module) prepareBuild();
module.exports = { prepareBuild };
