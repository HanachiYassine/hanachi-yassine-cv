const router = require('express').Router();
const db = require('./db');
const { authenticateToken } = require('./auth');
const { getCvData } = require('./cv.service');
const { editCv, restoreBackup } = require('./cv-store');
const { fail } = require('./cv-validation');
const { route, downloadJson } = require('./http-utils');
router.use(authenticateToken);

router.get('/cv', route(async (req, res) => res.json(await getCvData())));
router.put('/cv', route(async (req, res) => {
    const allowed = ['infos', 'profil', 'competences', 'formation', 'langues', 'certificats', 'centresInteret'];
    if (Object.keys(req.body).some(key => !allowed.includes(key))) fail('Champ non modifiable par cette route.');
    const data = await editCv('informations du CV', current => ({ ...current, ...req.body }));
    res.json(data);
}));

router.get('/export', route(async (req, res) => {
    downloadJson(res, await getCvData(), `data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
}));
router.get('/backups', route(async (req, res) => {
    res.json(await db.all('SELECT id, created_at, reason FROM cv_backups ORDER BY id DESC'));
}));
router.get('/backups/:id', route(async (req, res) => {
    const backup = await db.get('SELECT data_json FROM cv_backups WHERE id = ?', [req.params.id]);
    if (!backup) return res.status(404).json({ message: 'Sauvegarde introuvable.' });
    downloadJson(res, JSON.parse(backup.data_json), `data-backup-${req.params.id}.json`);
}));
router.post('/backups/:id/restore', route(async (req, res) => {
    res.json(await restoreBackup(req.params.id));
}));

module.exports = router;
