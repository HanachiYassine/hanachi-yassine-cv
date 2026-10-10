const express = require('express');
const cors = require('cors');
const path = require('path');

const cvService = require('./cv.service');
const auth = require('./auth');
const adminExperiencesRoutes = require('./admin-experiences.routes');

const app = express();
const db = require('./db');
const PORT = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const origins = (process.env.CORS_ORIGINS || 'http://localhost:4200').split(',').map(value => value.trim());

app.use(cors({ origin(origin, callback) {
    callback(null, !origin || origins.includes(origin));
} }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API to serve CV data from DB
app.get('/api/cv', async (req, res) => {
    try {
        const data = await cvService.getCvData();
        res.json(data);
    } catch (error) {
        console.error('Error fetching CV data:', error);
        res.status(500).send('Error fetching CV data');
    }
});

// Auth Routes
app.use('/api/admin', auth.router);

// Admin Experience Routes
app.use('/api/admin/experiences', adminExperiencesRoutes);
app.use('/api/admin', require('./admin-cv.routes'));
app.get('/health', (req, res) => res.json({ status: 'ok', commit: process.env.RENDER_GIT_COMMIT || undefined }));

// PDF généré depuis le même CV que l’API publique.
app.get('/api/pdf', require('./http-utils').route(async (req, res) => {
    const pdf = await require('./pdf.service').generatePdf();
    res.set('Cache-Control', 'no-store').contentType('application/pdf').send(pdf);
}));

app.use((error, req, res, next) => {
    console.error('Request failed:', error.code || error.status || 'internal');
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Erreur interne du serveur.' });
});

if (require.main === module) db.ready.then(() => app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server listening on port ${PORT}`);
})).catch(error => {
    console.error('Database initialization failed:', error.message);
    db.close();
    process.exitCode = 1;
});

module.exports = app;
