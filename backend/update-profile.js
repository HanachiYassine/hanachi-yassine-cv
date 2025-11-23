const db = require('./db');

const nouveauProfil = `Développeur Full-Stack senior spécialisé en Java/Spring Boot et Angular, avec plus de 10 ans d’expérience dans la conception, l’architecture et la réalisation d’applications web au sein de grands comptes (SNCF, Orange, Ministère, Groupama). Expert sur Java 17/21, Spring Boot 3, Angular 15-18, QueryDSL et PostgreSQL, j’interviens sur des projets complexes intégrant microservices, batchs critiques, optimisation de performances et pipelines CI/CD industrialisés.
Polyvalent et orienté qualité, je maîtrise l’ensemble du cycle de développement : conception technique, développement backend/frontend, gestion d’état avancée, sécurisation, tests automatisés, revue de code et intégration continue. Reconnu pour ma rigueur, mon autonomie et ma capacité à comprendre rapidement les enjeux métier, j’apporte des solutions robustes, maintenables et évolutives dans des environnements agiles exigeants.`;

db.serialize(() => {
    db.run('UPDATE profil SET contenu = ? WHERE id = 1', [nouveauProfil], function (err) {
        if (err) {
            console.error('Error updating profile:', err);
            db.close();
            process.exit(1);
        }

        if (this.changes === 0) {
            console.log('No existing profile found. Inserting new one...');
            db.run('INSERT INTO profil (id, contenu) VALUES (1, ?)', [nouveauProfil], function (err) {
                if (err) {
                    console.error('Error inserting profile:', err);
                    db.close();
                    process.exit(1);
                }
                console.log('Profile inserted successfully.');
                db.close();
            });
        } else {
            console.log('Profil updated successfully');
            db.close();
        }
    });
});
