const { infoKeys, expKeys, projectKeys } = require('./cv-serialization');
const categories = Object.keys(require('./data.json').competences);

function fail(message) {
    const error = new Error(message);
    error.status = 400;
    throw error;
}

function text(value, label, required = false) {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || value.length > 20000 || (required && !value.trim())) fail(`Champ invalide : ${label}.`);
    return value;
}

function list(value, label) {
    if (!Array.isArray(value) || value.length > 500) fail(`Liste invalide : ${label}.`);
    return value;
}

function strings(value, label) {
    return list(value || [], label).map(item => text(item, label, true));
}

function record(value, keys, required = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Objet invalide.');
    const result = Object.fromEntries(keys.map(key => [key, text(value[key], key, required.includes(key))]));
    if (value.id != null) {
        if (!Number.isSafeInteger(value.id) || value.id < 1) fail('Identifiant invalide.');
        result.id = value.id;
    }
    return result;
}

function project(value) {
    return { ...record(value, projectKeys, ['titre']),
        missions: strings(value.missions, 'missions'), technologies: strings(value.technologies, 'technologies') };
}

function experience(value) {
    return { ...record(value, expKeys, ['poste', 'entreprise', 'periode']),
        missions: strings(value.missions, 'missions'), technologies: strings(value.technologies, 'technologies'),
        projets: list(value.projets || [], 'sous-projets').map(project) };
}

function skills(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Compétences invalides.');
    return Object.fromEntries(Object.entries(value).map(([key, items]) => {
        if (!categories.includes(key)) fail(`Catégorie inconnue : ${key}.`);
        return [key, strings(items, key)];
    }));
}

function uniqueIds(rows) {
    const ids = rows.filter(row => row.id != null).map(row => row.id);
    if (new Set(ids).size !== ids.length) fail('Identifiants dupliqués.');
}

function validateCv(value) {
    if (!value || typeof value !== 'object') fail('CV invalide.');
    const data = { infos: record(value.infos, infoKeys, ['nom', 'titre']), profil: text(value.profil, 'profil'),
        competences: skills(value.competences), experiences: list(value.experiences, 'expériences').map(experience),
        formation: list(value.formation, 'formations').map(row => record(row, ['etab', 'periode', 'diplome'], ['etab', 'periode', 'diplome'])),
        langues: list(value.langues, 'langues').map(row => record(row, ['langue', 'niveau'], ['langue', 'niveau'])),
        certificats: strings(value.certificats, 'certificats'), centresInteret: strings(value.centresInteret, 'centres d’intérêt') };
    if (data.infos.linkedin && !/^https?:\/\//i.test(data.infos.linkedin)) fail('Le lien LinkedIn doit utiliser HTTP ou HTTPS.');
    [data.experiences, data.formation, data.langues, data.experiences.flatMap(exp => exp.projets)].forEach(uniqueIds);
    return data;
}

module.exports = { validateCv, experience, fail };
