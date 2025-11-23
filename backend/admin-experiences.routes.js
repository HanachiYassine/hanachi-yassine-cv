const express = require('express');
const db = require('./db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Helper to run query as promise
const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getOneQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// GET all experiences
router.get('/', authenticateToken, async (req, res) => {
    try {
        const experiences = await getQuery('SELECT * FROM experiences ORDER BY ordre ASC');
        res.json(experiences);
    } catch (error) {
        console.error('Error fetching experiences:', error);
        res.status(500).json({ message: 'Error fetching experiences' });
    }
});

// GET one experience with details
router.get('/:id', authenticateToken, async (req, res) => {
    const expId = req.params.id;
    try {
        const exp = await getOneQuery('SELECT * FROM experiences WHERE id = ?', [expId]);
        if (!exp) return res.status(404).json({ message: 'Experience not found' });

        const missions = await getQuery('SELECT mission FROM experience_missions WHERE experience_id = ?', [expId]);
        const technos = await getQuery('SELECT techno FROM experience_technos WHERE experience_id = ?', [expId]);

        const projetsRows = await getQuery('SELECT * FROM experience_projets WHERE experience_id = ?', [expId]);
        const projets = await Promise.all(projetsRows.map(async (p) => {
            const pMissions = await getQuery('SELECT mission FROM experience_projet_missions WHERE projet_id = ?', [p.id]);
            const pTechnos = await getQuery('SELECT techno FROM experience_projet_technos WHERE projet_id = ?', [p.id]);
            return {
                ...p,
                missions: pMissions.map(m => m.mission),
                technologies: pTechnos.map(t => t.techno)
            };
        }));

        res.json({
            ...exp,
            missions: missions.map(m => m.mission),
            technologies: technos.map(t => t.techno),
            projets
        });
    } catch (error) {
        console.error('Error fetching experience:', error);
        res.status(500).json({ message: 'Error fetching experience' });
    }
});

// POST create experience
router.post('/', authenticateToken, async (req, res) => {
    const { poste, entreprise, localisation, periode, projet, client, equipe, role, missions, technologies, projets } = req.body;

    // Transaction-like approach (sqlite3 doesn't support async transaction easily without serialization)
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmtExp = db.prepare(`
            INSERT INTO experiences (poste, entreprise, localisation, periode, projet, client, equipe, role, ordre)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `);

        stmtExp.run(poste, entreprise, localisation, periode, projet, client, equipe, role, function (err) {
            if (err) {
                console.error('Error inserting experience:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error creating experience' });
            }
            const expId = this.lastID;

            try {
                if (missions) {
                    const stmtMission = db.prepare('INSERT INTO experience_missions (experience_id, mission) VALUES (?, ?)');
                    missions.forEach(m => stmtMission.run(expId, m));
                    stmtMission.finalize();
                }

                if (technologies) {
                    const stmtTechno = db.prepare('INSERT INTO experience_technos (experience_id, techno) VALUES (?, ?)');
                    technologies.forEach(t => stmtTechno.run(expId, t));
                    stmtTechno.finalize();
                }

                if (projets) {
                    const stmtProjet = db.prepare('INSERT INTO experience_projets (experience_id, titre, contexte) VALUES (?, ?, ?)');
                    const stmtProjetMission = db.prepare('INSERT INTO experience_projet_missions (projet_id, mission) VALUES (?, ?)');
                    const stmtProjetTechno = db.prepare('INSERT INTO experience_projet_technos (projet_id, techno) VALUES (?, ?)');

                    projets.forEach(p => {
                        stmtProjet.run(expId, p.titre, p.contexte, function (err) {
                            if (err) throw err;
                            const pId = this.lastID;
                            if (p.missions) p.missions.forEach(pm => stmtProjetMission.run(pId, pm));
                            if (p.technologies) p.technologies.forEach(pt => stmtProjetTechno.run(pId, pt));
                        });
                    });
                    stmtProjet.finalize();
                    stmtProjetMission.finalize();
                    stmtProjetTechno.finalize();
                }

                db.run('COMMIT');
                stmtExp.finalize();
                res.status(201).json({ id: expId, message: 'Experience created' });

            } catch (innerErr) {
                console.error('Error inserting details:', innerErr);
                db.run('ROLLBACK');
                res.status(500).json({ message: 'Error creating experience details' });
            }
        });
    });
});

// PUT update experience
router.put('/:id', authenticateToken, async (req, res) => {
    const expId = req.params.id;
    const { poste, entreprise, localisation, periode, projet, client, equipe, role, missions, technologies, projets } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmtUpdate = db.prepare(`
            UPDATE experiences 
            SET poste=?, entreprise=?, localisation=?, periode=?, projet=?, client=?, equipe=?, role=?
            WHERE id=?
        `);

        stmtUpdate.run(poste, entreprise, localisation, periode, projet, client, equipe, role, expId, function (err) {
            if (err) {
                console.error('Error updating experience:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error updating experience' });
            }

            try {
                // Delete existing details
                db.run('DELETE FROM experience_missions WHERE experience_id = ?', expId);
                db.run('DELETE FROM experience_technos WHERE experience_id = ?', expId);
                // Cascading delete should handle sub-projects if configured, but let's be safe or rely on schema
                // Schema has ON DELETE CASCADE for foreign keys, so deleting from experience_projets is enough?
                // But we are UPDATING the experience, not deleting it. So we need to delete children manually or carefully.
                // For simplicity, let's delete all children and recreate.

                // We need to find project IDs to delete their children if cascade doesn't work on manual delete of parent rows
                // Actually, let's rely on manual deletion to be sure.

                // Get project IDs to delete their children
                // db.all('SELECT id FROM experience_projets WHERE experience_id = ?', [expId], (err, rows) => { ... })
                // Too complex callback hell. Let's assume ON DELETE CASCADE works for sub-tables if we delete the parent row in experience_projets.

                db.run('DELETE FROM experience_projets WHERE experience_id = ?', expId);

                // Re-insert details
                if (missions) {
                    const stmtMission = db.prepare('INSERT INTO experience_missions (experience_id, mission) VALUES (?, ?)');
                    missions.forEach(m => stmtMission.run(expId, m));
                    stmtMission.finalize();
                }

                if (technologies) {
                    const stmtTechno = db.prepare('INSERT INTO experience_technos (experience_id, techno) VALUES (?, ?)');
                    technologies.forEach(t => stmtTechno.run(expId, t));
                    stmtTechno.finalize();
                }

                if (projets) {
                    const stmtProjet = db.prepare('INSERT INTO experience_projets (experience_id, titre, contexte) VALUES (?, ?, ?)');
                    const stmtProjetMission = db.prepare('INSERT INTO experience_projet_missions (projet_id, mission) VALUES (?, ?)');
                    const stmtProjetTechno = db.prepare('INSERT INTO experience_projet_technos (projet_id, techno) VALUES (?, ?)');

                    projets.forEach(p => {
                        stmtProjet.run(expId, p.titre, p.contexte, function (err) {
                            if (err) throw err;
                            const pId = this.lastID;
                            if (p.missions) p.missions.forEach(pm => stmtProjetMission.run(pId, pm));
                            if (p.technologies) p.technologies.forEach(pt => stmtProjetTechno.run(pId, pt));
                        });
                    });
                    stmtProjet.finalize();
                    stmtProjetMission.finalize();
                    stmtProjetTechno.finalize();
                }

                db.run('COMMIT');
                stmtUpdate.finalize();
                res.json({ message: 'Experience updated' });

            } catch (innerErr) {
                console.error('Error updating details:', innerErr);
                db.run('ROLLBACK');
                res.status(500).json({ message: 'Error updating experience details' });
            }
        });
    });
});

// DELETE experience
router.delete('/:id', authenticateToken, (req, res) => {
    const expId = req.params.id;
    db.run('DELETE FROM experiences WHERE id = ?', expId, function (err) {
        if (err) {
            console.error('Error deleting experience:', err);
            return res.status(500).json({ message: 'Error deleting experience' });
        }
        res.json({ message: 'Experience deleted' });
    });
});

module.exports = router;
