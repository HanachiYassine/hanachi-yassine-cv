const db = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const util = require('util');

const dataPath = path.join(__dirname, 'data.json');
let cvData = {};

try {
    cvData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
    console.error("Error loading data.json:", err);
    process.exit(1);
}

// Promisify db.run
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const migrate = async () => {
    console.log('Starting migration...');

    try {
        // Clear existing data
        await dbRun('DELETE FROM experience_projet_technos');
        await dbRun('DELETE FROM experience_projet_missions');
        await dbRun('DELETE FROM experience_projets');
        await dbRun('DELETE FROM experience_technos');
        await dbRun('DELETE FROM experience_missions');
        await dbRun('DELETE FROM experiences');
        await dbRun('DELETE FROM competences');
        await dbRun('DELETE FROM profil');
        await dbRun('DELETE FROM infos');
        await dbRun('DELETE FROM formations');
        await dbRun('DELETE FROM langues');
        await dbRun('DELETE FROM certificats');
        await dbRun('DELETE FROM centres_interet');
        await dbRun('DELETE FROM users');

        // 1. Infos
        await dbRun(`
            INSERT INTO infos (id, nom, titre, adresse, tel, email, preavis, linkedin, age, nationalite, statut)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cvData.infos.nom,
            cvData.infos.titre,
            cvData.infos.adresse,
            cvData.infos.tel,
            cvData.infos.email,
            cvData.infos.preavis,
            cvData.infos.linkedin,
            cvData.infos.age,
            cvData.infos.nationalite,
            cvData.infos.statut
        ]);
        console.log('Infos migrated.');

        // 2. Profil
        await dbRun('INSERT INTO profil (id, contenu) VALUES (1, ?)', [cvData.profil]);
        console.log('Profil migrated.');

        // 3. Competences
        for (const [category, items] of Object.entries(cvData.competences)) {
            for (const item of items) {
                await dbRun('INSERT INTO competences (categorie, item) VALUES (?, ?)', [category, item]);
            }
        }
        console.log('Competences migrated.');

        // 4. Experiences
        for (const [index, exp] of cvData.experiences.entries()) {
            const result = await dbRun(`
                INSERT INTO experiences (poste, entreprise, localisation, periode, projet, client, equipe, role, ordre)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                exp.poste,
                exp.entreprise,
                exp.localisation,
                exp.periode,
                exp.projet || null,
                exp.client || null,
                exp.equipe || null,
                exp.role || null,
                index
            ]);

            const expId = result.lastID;

            if (exp.missions) {
                for (const m of exp.missions) {
                    await dbRun('INSERT INTO experience_missions (experience_id, mission) VALUES (?, ?)', [expId, m]);
                }
            }
            if (exp.technologies) {
                for (const t of exp.technologies) {
                    await dbRun('INSERT INTO experience_technos (experience_id, techno) VALUES (?, ?)', [expId, t]);
                }
            }

            if (exp.projets) { // Note: 'projets' (plural) in JSON vs 'projet' (singular) column in experiences table
                for (const p of exp.projets) {
                    const pResult = await dbRun(`
                        INSERT INTO experience_projets (experience_id, titre, contexte)
                        VALUES (?, ?, ?)
                    `, [expId, p.titre, p.contexte || null]);

                    const pId = pResult.lastID;

                    if (p.missions) {
                        for (const pm of p.missions) {
                            await dbRun('INSERT INTO experience_projet_missions (projet_id, mission) VALUES (?, ?)', [pId, pm]);
                        }
                    }
                    if (p.technologies) {
                        for (const pt of p.technologies) {
                            await dbRun('INSERT INTO experience_projet_technos (projet_id, techno) VALUES (?, ?)', [pId, pt]);
                        }
                    }
                }
            }
        }
        console.log('Experiences migrated.');

        // 5. Formations
        for (const [index, f] of cvData.formation.entries()) {
            await dbRun(`
                INSERT INTO formations (etab, periode, diplome, ordre)
                VALUES (?, ?, ?, ?)
            `, [f.etab, f.periode, f.diplome, index]);
        }
        console.log('Formations migrated.');

        // 6. Langues
        for (const l of cvData.langues) {
            await dbRun('INSERT INTO langues (langue, niveau) VALUES (?, ?)', [l.langue, l.niveau]);
        }
        console.log('Langues migrated.');

        // 7. Certificats
        for (const c of cvData.certificats) {
            await dbRun('INSERT INTO certificats (intitule) VALUES (?)', [c]);
        }
        console.log('Certificats migrated.');

        // 8. Centres d'intérêt
        for (const c of cvData.centresInteret) {
            await dbRun('INSERT INTO centres_interet (interet) VALUES (?)', [c]);
        }
        console.log('Centres d\'intérêt migrated.');

        // 9. Admin User
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await dbRun('INSERT INTO users (email, password_hash) VALUES (?, ?)', [adminEmail, hashedPassword]);
        console.log(`Admin user created: ${adminEmail} / ${adminPassword}`);

        console.log('Migration completed successfully.');
        db.close();
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        db.close();
        process.exit(1);
    }
};

migrate();
