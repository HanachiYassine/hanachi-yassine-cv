const db = require('./db');

const { profil: nouveauProfil } = require('./data.json');

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
