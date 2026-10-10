const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@libsql/client');
const { initialize } = require('../initialize-db');
const { getCvData } = require('../cv.service');

test('initialisation Turso : aucun écrasement au redémarrage, données et sauvegardes conservées', async () => {
    const client = createClient({ url: ':memory:' });
    try {
        await initialize(client, 'turso');
        const data = await getCvData(client);
        assert.equal(data.experiences.length, 7);
        await client.execute("UPDATE profil SET contenu = 'Profil modifié en ligne' WHERE id = 1");
        await initialize(client, 'turso');
        assert.equal((await getCvData(client)).profil, 'Profil modifié en ligne');
        assert.equal((await client.execute('SELECT COUNT(*) AS total FROM cv_backups')).rows[0].total, 1);
    } finally { client.close(); }
});
