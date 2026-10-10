const tables = ['infos', 'profil', 'competences', 'experiences', 'experience_missions',
    'experience_technos', 'experience_projets', 'experience_projet_missions',
    'experience_projet_technos', 'formations', 'langues', 'certificats', 'centres_interet'];
const infoKeys = ['nom', 'titre', 'adresse', 'tel', 'email', 'preavis', 'linkedin', 'age', 'nationalite', 'statut'];
const expKeys = ['poste', 'entreprise', 'localisation', 'periode', 'projet', 'client', 'equipe', 'role'];
const projectKeys = ['titre', 'contexte', 'equipe', 'role'];

function insert(table, values) {
    const columns = Object.keys(values);
    return { sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
        args: columns.map(key => values[key] ?? null) };
}

function pick(value, keys) {
    return Object.fromEntries(keys.map(key => [key, value[key] ?? '']));
}

function leafStatements(table, foreignKey, id, key, values = []) {
    return values.map(value => insert(table, { [foreignKey]: id, [key]: value }));
}

function projectStatements(project, experienceId, id) {
    return [insert('experience_projets', { id, experience_id: experienceId, ...pick(project, projectKeys) }),
        ...leafStatements('experience_projet_missions', 'projet_id', id, 'mission', project.missions),
        ...leafStatements('experience_projet_technos', 'projet_id', id, 'techno', project.technologies)];
}

function experienceStatements(experience, id, ordre, projectCounter) {
    return [insert('experiences', { id, ...pick(experience, expKeys), ordre }),
        ...leafStatements('experience_missions', 'experience_id', id, 'mission', experience.missions),
        ...leafStatements('experience_technos', 'experience_id', id, 'techno', experience.technologies),
        ...(experience.projets || []).flatMap(project => projectStatements(project, id, project.id || projectCounter.next++))];
}

function maxId(rows) {
    return Math.max(0, ...rows.map(row => row.id || 0)) + 1;
}

function rowStatements(table, rows, keys, ordered = false) {
    let next = maxId(rows);
    return rows.map((row, ordre) => insert(table, { id: row.id || next++, ...pick(row, keys), ...(ordered ? { ordre } : {}) }));
}

function cvStatements(data) {
    let nextExp = maxId(data.experiences);
    const projects = { next: maxId(data.experiences.flatMap(exp => exp.projets || [])) };
    return [insert('infos', { id: 1, ...pick(data.infos, infoKeys) }), insert('profil', { id: 1, contenu: data.profil }),
        ...Object.entries(data.competences).flatMap(([categorie, items]) => items.map(item => insert('competences', { categorie, item }))),
        ...data.experiences.flatMap((exp, ordre) => experienceStatements(exp, exp.id || nextExp++, ordre, projects)),
        ...rowStatements('formations', data.formation, ['etab', 'periode', 'diplome'], true),
        ...rowStatements('langues', data.langues, ['langue', 'niveau']),
        ...data.certificats.map(intitule => insert('certificats', { intitule })),
        ...data.centresInteret.map(interet => insert('centres_interet', { interet }))];
}

const clearStatements = [...tables].reverse().map(table => ({ sql: `DELETE FROM ${table}`, args: [] }));
const readStatements = tables.map(table => ({ sql: `SELECT * FROM ${table} ORDER BY ${['experiences', 'formations'].includes(table) ? 'ordre, id' : 'id'}`, args: [] }));

module.exports = { tables, infoKeys, expKeys, projectKeys, insert, cvStatements, clearStatements, readStatements };
