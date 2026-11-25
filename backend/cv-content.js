const assert = require('node:assert/strict');
const { validateCv } = require('./cv-validation');
const source = require('./data.json');

function contains(actual, expected, label) {
    for (const value of expected) assert.ok(actual.includes(value), `${label} manquant : ${value}`);
}

function checkProject(actual, expected) {
    assert.ok(actual, `Sous-projet manquant : ${expected.titre}`);
    for (const key of ['contexte', 'equipe', 'role']) {
        if (expected[key]) assert.equal(actual[key], expected[key], `Sous-projet : ${key} différent.`);
    }
    contains(actual.missions, expected.missions, 'Mission de sous-projet');
    contains(actual.technologies, expected.technologies, 'Technologie de sous-projet');
}

function identity(exp) {
    return JSON.stringify([exp.entreprise, exp.projet, exp.periode]);
}

function checkExperience(actual, expected) {
    assert.ok(actual, `Expérience manquante ou période incorrecte : ${expected.entreprise} ${expected.periode}`);
    for (const key of ['poste', 'localisation', 'client', 'role']) {
        if (expected[key]) assert.equal(actual[key], expected[key], `${expected.entreprise} : ${key} différent.`);
    }
    contains(actual.missions, expected.missions, 'Mission');
    contains(actual.technologies, expected.technologies, 'Technologie');
    for (const project of expected.projets) {
        checkProject(actual.projets.find(row => row.titre === project.titre), project);
    }
}

function checkPublishedCv(value, reference = source) {
    const actual = validateCv(value);
    const expected = validateCv(reference);
    assert.equal(actual.infos.nom, expected.infos.nom, 'Identité du CV incorrecte.');
    const keys = actual.experiences.map(identity);
    assert.equal(new Set(keys).size, keys.length, 'Expériences dupliquées.');
    for (const exp of expected.experiences) {
        checkExperience(actual.experiences.find(row => identity(row) === identity(exp)), exp);
    }
    return actual;
}

module.exports = { checkPublishedCv };
