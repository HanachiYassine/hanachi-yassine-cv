const router = require('express').Router();
const { authenticateToken } = require('./auth');
const { getCvData } = require('./cv.service');
const { editCv } = require('./cv-store');
const { experience, fail } = require('./cv-validation');
const { route } = require('./http-utils');
router.use(authenticateToken);

function experienceId(req) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) fail('Identifiant invalide.');
    return id;
}

function findIndex(data, id) {
    const index = data.experiences.findIndex(exp => exp.id === id);
    if (index < 0) { const error = new Error('Expérience introuvable.'); error.status = 404; throw error; }
    return index;
}

router.get('/', route(async (req, res) => {
    const data = await getCvData();
    res.json(data.experiences.map((exp, ordre) => ({ ...exp, ordre })));
}));
router.get('/:id', route(async (req, res) => {
    const data = await getCvData();
    res.json(data.experiences[findIndex(data, experienceId(req))]);
}));
router.post('/', route(async (req, res) => {
    const exp = experience(req.body);
    const data = await editCv('ajout expérience', current => {
        exp.id = Math.max(0, ...current.experiences.map(row => row.id)) + 1;
        current.experiences.unshift(exp);
        return current;
    });
    res.status(201).json({ id: data.experiences[0].id, message: 'Expérience créée.' });
}));
router.put('/:id', route(async (req, res) => {
    const id = experienceId(req);
    const exp = { ...experience(req.body), id };
    await editCv('modification expérience', current => {
        current.experiences[findIndex(current, id)] = exp;
        return current;
    });
    res.json({ message: 'Expérience modifiée.' });
}));
router.delete('/:id', route(async (req, res) => {
    const id = experienceId(req);
    await editCv('suppression expérience', current => {
        current.experiences.splice(findIndex(current, id), 1);
        return current;
    });
    res.json({ message: 'Expérience supprimée.' });
}));

module.exports = router;
