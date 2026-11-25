const fs = require('node:fs/promises');
const { parseArgs } = require('node:util');
const { prepareCareerUpdate } = require('../career-update');
const logger = require('../logger');

async function read(file) {
    if (!file) throw new Error('Chemin JSON requis.');
    return JSON.parse(await fs.readFile(file, 'utf8'));
}

function connectionOptions() {
    require('dotenv').config({ quiet: true });
    const provider = process.env.DATABASE_PROVIDER;
    if (provider === 'sqlite' && process.env.SQLITE_PATH) return { url: `file:${process.env.SQLITE_PATH}` };
    if (provider !== 'turso' || !/^(libsql|https):\/\//.test(process.env.TURSO_DATABASE_URL || '')
        || !process.env.TURSO_AUTH_TOKEN) throw new Error('Configuration explicite SQLite ou Turso requise.');
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
}

async function apply(options) {
    const before = await read(options.before);
    const after = await read(options.after);
    const { createClient } = require('@libsql/client');
    const { applyCareerUpdate } = require('../career-update-store');
    const client = createClient(connectionOptions());
    try {
        await client.execute('PRAGMA foreign_keys = ON');
        const changed = await applyCareerUpdate(client, before, after);
        logger.info('Mise à jour de carrière', { changed });
    } finally { client.close(); }
}

async function main() {
    const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' },
        before: { type: 'string' }, after: { type: 'string' }, apply: { type: 'boolean', default: false } } });
    if (values.apply) {
        if (values.input || values.output) throw new Error('Utiliser --before et --after avec --apply.');
        return apply(values);
    }
    if (!values.output || values.before || values.after) throw new Error('Préparation : --input et --output requis.');
    const data = prepareCareerUpdate(await read(values.input));
    await fs.writeFile(values.output, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    logger.info('Correctif préparé hors ligne', { output: values.output, experiences: data.experiences.length });
}

main().catch(error => { logger.error('Échec de la mise à jour de carrière', error); process.exitCode = 1; });
