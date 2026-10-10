const { randomBytes, createHash, createHmac } = require('crypto');
const bcrypt = require('bcrypt');
const db = require('./db');
const mailer = require('./password-reset-mailer');
const WINDOW = 15 * 60 * 1000;

function fail(status, message) {
    throw Object.assign(new Error(message), { status });
}

function digestToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function validInput(body) {
    const { token, password, confirmation } = body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail(400, 'Lien invalide ou expiré.');
    if (typeof password !== 'string' || password.length < 12) fail(400, 'Le mot de passe doit contenir au moins 12 caractères.');
    if (Buffer.byteLength(password, 'utf8') > 72) fail(400, 'Le mot de passe est trop long.');
    if (password !== confirmation) fail(400, 'Les deux mots de passe doivent être identiques.');
    return { digest: digestToken(token), password };
}

async function recordLimit(tx, bucket, maximum, now) {
    const { rows } = await tx.execute({ sql: 'SELECT count, expires_at FROM password_reset_limits WHERE bucket = ?', args: [bucket] });
    const existing = rows[0];
    const count = existing && Number(existing.expires_at) > now ? Number(existing.count) + 1 : 1;
    if (count > maximum) fail(429, 'Trop de demandes. Réessayez dans 15 minutes.');
    const expires = existing && Number(existing.expires_at) > now ? Number(existing.expires_at) : now + WINDOW;
    await tx.execute({ sql: 'INSERT INTO password_reset_limits (bucket, count, expires_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(bucket) DO UPDATE SET count = excluded.count, expires_at = excluded.expires_at', args: [bucket, count, expires] });
}

function limitRequests(ip, action, globalMaximum, ipMaximum) {
    const secret = process.env.JWT_SECRET || 'local-development';
    const bucket = createHmac('sha256', secret).update(String(ip || 'unknown')).digest('hex');
    const now = Date.now();
    return db.transaction(async tx => {
        await tx.execute({ sql: 'DELETE FROM password_reset_limits WHERE expires_at <= ?', args: [now] });
        await recordLimit(tx, action + '/global', globalMaximum, now);
        await recordLimit(tx, action + '/' + bucket, ipMaximum, now);
    });
}

async function requestReset(ip) {
    const config = mailer.configuration();
    await limitRequests(ip, 'request', 3, 3);
    const user = await db.get('SELECT id, email FROM users WHERE lower(email) = lower(?)', [config.email]);
    if (!user) return;
    const token = randomBytes(32).toString('hex');
    const digest = digestToken(token);
    await db.run('DELETE FROM password_reset_tokens WHERE expires_at <= ?', [Date.now()]);
    await db.run('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [digest, user.id, Date.now() + WINDOW]);
    try { await mailer.sendLink(config, user, token, digest); }
    catch (failure) {
        await db.run('DELETE FROM password_reset_tokens WHERE token_hash = ?', [digest]);
        throw failure;
    }
}

async function consumeToken(tx, digest, passwordHash) {
    const { rows } = await tx.execute({ sql: 'DELETE FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ? RETURNING user_id',
        args: [digest, Date.now()] });
    if (!rows.length) fail(400, 'Lien invalide ou expiré.');
    const id = Number(rows[0].user_id);
    await tx.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [passwordHash, id] });
    await tx.execute({ sql: 'INSERT INTO user_auth_state (user_id, version) VALUES (?, 1) ' +
        'ON CONFLICT(user_id) DO UPDATE SET version = version + 1', args: [id] });
    await tx.execute({ sql: 'DELETE FROM password_reset_tokens WHERE user_id = ?', args: [id] });
    const user = await tx.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [id] });
    return user.rows[0].email;
}

async function resetPassword(body, ip) {
    const { digest, password } = validInput(body);
    const config = mailer.configuration();
    await limitRequests(ip, 'redeem', 50, 20);
    const stored = await db.get('SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?', [digest, Date.now()]);
    if (!stored) fail(400, 'Lien invalide ou expiré.');
    const passwordHash = await bcrypt.hash(password, 12);
    const email = await db.transaction(tx => consumeToken(tx, digest, passwordHash));
    await mailer.sendConfirmation(config, email, digest);
}

module.exports = { requestReset, resetPassword };
