const { tables, readStatements, projectKeys } = require('./cv-serialization');

function values(rows, key, id, value) {
    return rows.filter(row => row[key] === id).map(row => row[value]);
}

function projectData(project, data) {
    return { id: project.id, ...Object.fromEntries(projectKeys.map(key => [key, project[key] ?? ''])),
        missions: values(data.experience_projet_missions, 'projet_id', project.id, 'mission'),
        technologies: values(data.experience_projet_technos, 'projet_id', project.id, 'techno') };
}

function experienceData(experience, data) {
    const { ordre, ...exp } = experience;
    const projets = data.experience_projets.filter(row => row.experience_id === exp.id).map(row => projectData(row, data));
    return { ...exp, missions: values(data.experience_missions, 'experience_id', exp.id, 'mission'),
        technologies: values(data.experience_technos, 'experience_id', exp.id, 'techno'),
        ...(projets.length ? { projets } : {}) };
}

function assemble(results) {
    const data = Object.fromEntries(tables.map((table, index) => [table, results[index].rows.map(row => ({ ...row }))]));
    const competences = {};
    for (const { categorie, item } of data.competences) (competences[categorie] ||= []).push(item);
    return { infos: data.infos[0], profil: data.profil[0]?.contenu || '', competences,
        experiences: data.experiences.map(exp => experienceData(exp, data)), formation: data.formations,
        langues: data.langues, certificats: data.certificats.map(row => row.intitule),
        centresInteret: data.centres_interet.map(row => row.interet) };
}

async function getCvData(connection = require('./db')) {
    return assemble(await connection.batch(readStatements, 'read'));
}

module.exports = { getCvData };
