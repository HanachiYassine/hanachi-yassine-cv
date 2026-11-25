const assert = require('node:assert/strict');
const { validateCv } = require('./cv-validation');
const source = validateCv(require('./data.json'));

function companyName(value) {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
}

function single(rows, company, required = true) {
    const matches = rows.filter(row => companyName(row.entreprise) === companyName(company));
    assert.ok(matches.length <= 1 && (!required || matches.length === 1), `Expérience ambiguë ou absente : ${company}`);
    return matches[0];
}

function checkIds(data) {
    const rows = [...data.experiences, ...data.experiences.flatMap(exp => exp.projets)];
    assert.ok(rows.every(row => Number.isSafeInteger(row.id)), 'Utiliser un export de la base avec les identifiants.');
}

function addFranceTravail(data) {
    const target = single(source.experiences, 'FRANCE TRAVAIL');
    const existing = single(data.experiences, target.entreprise, false);
    if (existing) {
        assert.deepEqual({ ...existing, id: undefined }, { ...target, id: undefined },
            'France Travail existe avec un contenu différent : rapprochement manuel requis.');
        return;
    }
    const id = Math.max(0, ...data.experiences.map(row => row.id)) + 1;
    data.experiences.unshift({ ...structuredClone(target), id });
}

function prepareCareerUpdate(value) {
    const data = validateCv(value);
    checkIds(data);
    const sncf = single(data.experiences, 'SNCF RÉSEAU');
    const target = single(source.experiences, 'SNCF RÉSEAU');
    assert.ok(sncf.projet.includes('OPIPRO'), 'Le projet SNCF doit être OPIPRO.');
    Object.assign(sncf, target, { id: sncf.id, projets: sncf.projets });
    data.infos.titre = source.infos.titre;
    data.infos.adresse = source.infos.adresse;
    data.profil = source.profil;
    const skills = data.competences.langagesFrameworks ||= [];
    if (!skills.includes('Quarkus (mission en cours)')) skills.push('Quarkus (mission en cours)');
    addFranceTravail(data);
    return validateCv(data);
}

module.exports = { prepareCareerUpdate };
