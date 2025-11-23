const db = require('./db');

db.serialize(() => {
    // Update experience_technos
    db.run("UPDATE experience_technos SET techno = 'TypeScript' WHERE techno = 'TS'", function (err) {
        if (err) {
            console.error('Error updating experience_technos:', err);
        } else {
            console.log(`Updated ${this.changes} rows in experience_technos`);
        }
    });

    // Update experience_projet_technos
    db.run("UPDATE experience_projet_technos SET techno = 'TypeScript' WHERE techno = 'TS'", function (err) {
        if (err) {
            console.error('Error updating experience_projet_technos:', err);
        } else {
            console.log(`Updated ${this.changes} rows in experience_projet_technos`);
        }
    });
});
