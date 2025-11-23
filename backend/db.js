const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cv.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

const schema = `
    CREATE TABLE IF NOT EXISTS infos (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nom TEXT,
        titre TEXT,
        adresse TEXT,
        tel TEXT,
        email TEXT,
        preavis TEXT,
        linkedin TEXT,
        age TEXT,
        nationalite TEXT,
        statut TEXT
    );

    CREATE TABLE IF NOT EXISTS profil (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        contenu TEXT
    );

    CREATE TABLE IF NOT EXISTS competences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categorie TEXT NOT NULL,
        item TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS experiences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poste TEXT NOT NULL,
        entreprise TEXT NOT NULL,
        localisation TEXT,
        periode TEXT NOT NULL,
        projet TEXT,
        client TEXT,
        equipe TEXT,
        role TEXT,
        ordre INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS experience_missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experience_id INTEGER NOT NULL,
        mission TEXT NOT NULL,
        FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experience_technos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experience_id INTEGER NOT NULL,
        techno TEXT NOT NULL,
        FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experience_projets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experience_id INTEGER NOT NULL,
        titre TEXT NOT NULL,
        contexte TEXT,
        FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experience_projet_missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projet_id INTEGER NOT NULL,
        mission TEXT NOT NULL,
        FOREIGN KEY (projet_id) REFERENCES experience_projets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experience_projet_technos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projet_id INTEGER NOT NULL,
        techno TEXT NOT NULL,
        FOREIGN KEY (projet_id) REFERENCES experience_projets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS formations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        etab TEXT NOT NULL,
        periode TEXT NOT NULL,
        diplome TEXT NOT NULL,
        ordre INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS langues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        langue TEXT NOT NULL,
        niveau TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS certificats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intitule TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS centres_interet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interet TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    );
`;

db.serialize(() => {
    db.exec(schema, (err) => {
        if (err) {
            console.error("Error creating schema:", err);
        }
    });
});

module.exports = db;
