const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');
const { route } = require('./http-utils');
const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || SECRET_KEY.length < 32)) {
    throw new Error('JWT_SECRET de 32 caractères minimum est requis en production.');
}
const attempts = new Map();
const recovery = require('./password-reset.service');

function limitLogin(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const attempt = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
    if (++attempt.count > 20 || attempts.size > 10000) return res.status(429).json({ message: 'Réessayez dans quelques minutes.' });
    attempts.set(req.ip, attempt);
    next();
}

router.post('/login', limitLogin, route(async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 1000) {
        return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ message: 'Identifiants incorrects.' });
    const state = await db.get('SELECT version FROM user_auth_state WHERE user_id = ?', [user.id]);
    const token = jwt.sign({ email: user.email, id: user.id, sessionVersion: Number(state?.version || 0) }, SECRET_KEY, { expiresIn: '1h' });
    res.set('Cache-Control', 'no-store').json({ token });
}));

const authenticateToken = route(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    let user;
    try { user = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }); }
    catch { return res.sendStatus(403); }
    const state = await db.get('SELECT u.id, coalesce(s.version, 0) AS version FROM users u ' +
        'LEFT JOIN user_auth_state s ON s.user_id = u.id WHERE u.id = ?', [user.id]);
    if (!state || Number(state.version) !== (user.sessionVersion ?? 0)) return res.sendStatus(403);
    req.user = user;
    res.set('Cache-Control', 'no-store');
    next();
});

function requireJson(req, res, next) {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Une requête JSON est requise.' });
    next();
}

router.post('/forgot-password', requireJson, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    await recovery.requestReset(req.ip);
    res.status(202).json({ message: 'Si le compte administrateur est configuré, un lien a été envoyé à son adresse e-mail.' });
}));

router.post('/reset-password', requireJson, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    await recovery.resetPassword(req.body, req.ip);
    res.json({ message: 'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.' });
}));

module.exports = { router, authenticateToken };
