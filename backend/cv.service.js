const db = require('./db');
const util = require('util');

// Promisify db.all and db.get for easier async/await usage
const dbAll = util.promisify(db.all.bind(db));
const dbGet = util.promisify(db.get.bind(db));

const getCvData = async () => {
    try {
        // 1. Infos
        const infos = await dbGet('SELECT * FROM infos WHERE id = 1');

        // 2. Profil
        const profilRow = await dbGet('SELECT contenu FROM profil WHERE id = 1');
        const profil = profilRow ? profilRow.contenu : '';

        // 3. Competences
        const competencesRows = await dbAll('SELECT * FROM competences');
        const competences = {};
        competencesRows.forEach(row => {
            if (!competences[row.categorie]) {
                competences[row.categorie] = [];
            }
            competences[row.categorie].push(row.item);
        });

        // 4. Experiences
        const experiencesRows = await dbAll('SELECT * FROM experiences ORDER BY ordre ASC');
        const experiences = await Promise.all(experiencesRows.map(async (exp) => {
            const missions = await dbAll('SELECT mission FROM experience_missions WHERE experience_id = ?', [exp.id]);
            const technos = await dbAll('SELECT techno FROM experience_technos WHERE experience_id = ?', [exp.id]);

            const projetsRows = await dbAll('SELECT * FROM experience_projets WHERE experience_id = ?', [exp.id]);
            const projets = await Promise.all(projetsRows.map(async (p) => {
                const pMissions = await dbAll('SELECT mission FROM experience_projet_missions WHERE projet_id = ?', [p.id]);
                const pTechnos = await dbAll('SELECT techno FROM experience_projet_technos WHERE projet_id = ?', [p.id]);
                return {
                    id: p.id, // Keep ID for admin
                    titre: p.titre,
                    contexte: p.contexte,
                    missions: pMissions.map(m => m.mission),
                    technologies: pTechnos.map(t => t.techno)
                };
            }));

            return {
                id: exp.id, // Keep ID for admin
                poste: exp.poste,
                entreprise: exp.entreprise,
                localisation: exp.localisation,
                periode: exp.periode,
                projet: exp.projet,
                client: exp.client,
                equipe: exp.equipe,
                role: exp.role,
                missions: missions.map(m => m.mission),
                technologies: technos.map(t => t.techno),
                projets: projets.length > 0 ? projets : undefined
            };
        }));

        // 5. Formation
        const formation = await dbAll('SELECT * FROM formations ORDER BY ordre ASC');

        // 6. Langues
        const langues = await dbAll('SELECT * FROM langues');

        // 7. Certificats
        const certificatsRows = await dbAll('SELECT intitule FROM certificats');
        const certificats = certificatsRows.map(c => c.intitule);

        // 8. Centres d'intérêt
        const centresInteretRows = await dbAll('SELECT interet FROM centres_interet');
        const centresInteret = centresInteretRows.map(c => c.interet);

        return {
            infos,
            profil,
            competences,
            experiences,
            formation,
            langues,
            certificats,
            centresInteret
        };
    } catch (error) {
        console.error('Error fetching CV data:', error);
        throw error;
    }
};

module.exports = {
    getCvData
};
