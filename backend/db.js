require('dotenv').config({ quiet: true });
const path = require('path');
const { createClient } = require('@libsql/client');
const { initialize } = require('./initialize-db');

function connectionOptions() {
    const provider = process.env.DATABASE_PROVIDER || 'sqlite';
    if (provider === 'sqlite') return { url: `file:${path.resolve(__dirname, process.env.SQLITE_PATH || 'cv.db')}` };
    if (provider !== 'turso') throw new Error('DATABASE_PROVIDER doit être sqlite ou turso.');
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error('TURSO_DATABASE_URL et TURSO_AUTH_TOKEN sont requis.');
    if (!/^(libsql|https):\/\//.test(url)) throw new Error('Turso nécessite une URL libsql:// ou https://.');
    return { url, authToken };
}

const client = createClient(connectionOptions());
const ready = initialize(client, process.env.DATABASE_PROVIDER || 'sqlite');
ready.catch(() => {});

async function batch(statements, mode = 'read') {
    await ready;
    return client.batch(statements, mode);
}

async function all(sql, args = []) {
    const [result] = await batch([{ sql, args }]);
    return result.rows.map(row => ({ ...row }));
}

async function get(sql, args = []) {
    return (await all(sql, args))[0];
}

async function run(sql, args = []) {
    const [result] = await batch([{ sql, args }], 'write');
    return { lastID: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

async function transaction(work) {
    await ready;
    const tx = await client.transaction('write');
    try {
        const result = await work(tx);
        await tx.commit();
        return result;
    } catch (error) {
        await tx.rollback();
        throw error;
    } finally { tx.close(); }
}

module.exports = { ready, all, get, run, batch, transaction, close: () => client.close() };
