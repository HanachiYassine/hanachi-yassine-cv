const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { cvStatements, insert } = require('./cv-serialization');
const { getCvData } = require('./cv.service');

async function seedCv(client) {
    const result = await client.execute('SELECT COUNT(*) AS total FROM infos');
    if (result.rows[0].total) return;
    const occupied = await client.execute('SELECT COUNT(*) AS total FROM experiences');
    if (occupied.rows[0].total) throw new Error('Base partiellement remplie : import automatique annulé.');
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
    await client.batch(cvStatements(data), 'write');
}

async function seedAdmin(client) {
    const result = await client.execute('SELECT COUNT(*) AS total FROM users');
    if (result.rows[0].total) return;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD sont requis pour le premier démarrage.');
        return;
    }
    if (password.length < 12) throw new Error('ADMIN_PASSWORD doit contenir au moins 12 caractères.');
    const password_hash = await bcrypt.hash(password, 12);
    await client.batch([insert('users', { email, password_hash })], 'write');
}

async function seedBackup(client) {
    const result = await client.execute('SELECT COUNT(*) AS total FROM cv_backups');
    if (result.rows[0].total) return;
    const data = await getCvData(client);
    await client.batch([insert('cv_backups', { reason: 'initialisation', data_json: JSON.stringify(data) })], 'write');
}

async function initialize(client, provider) {
    await client.executeMultiple(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await client.execute('PRAGMA foreign_keys = ON');
    if (provider === 'sqlite') {
        const migration = path.join(__dirname, 'migrations/20261010-align-cv-aptineo.sql');
        await client.executeMultiple(fs.readFileSync(migration, 'utf8'));
    }
    await seedCv(client);
    await seedAdmin(client);
    await seedBackup(client);
}

module.exports = { initialize };
