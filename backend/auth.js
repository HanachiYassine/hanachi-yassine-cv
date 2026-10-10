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
    const token = jwt.sign({ email: user.email, id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.set('Cache-Control', 'no-store').json({ token });
}));

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }, (error, user) => {
        if (error) return res.sendStatus(403);
        req.user = user;
        res.set('Cache-Control', 'no-store');
        next();
    });
}

module.exports = { router, authenticateToken };
