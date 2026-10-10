const API_URL = '/api/admin';
let token = sessionStorage.getItem('cv-admin-token');
let currentCv;
let currentExpId;
const $ = id => document.getElementById(id);
const infoLabels = { nom: 'Nom', titre: 'Titre professionnel', adresse: 'Adresse', tel: 'Téléphone', email: 'Email',
    preavis: 'Préavis', linkedin: 'Lien LinkedIn', age: 'Âge', nationalite: 'Nationalité', statut: 'Statut' };
const skillLabels = { langagesFrameworks: 'Langages et frameworks', outils: 'Outils', serveurs: 'Serveurs',
    bdd: 'Bases de données', systemes: 'Systèmes', methodos: 'Méthodes', ide: 'Environnements de développement' };
const expLabels = { poste: 'Poste', entreprise: 'Entreprise', localisation: 'Localisation', periode: 'Période',
    projet: 'Projet', client: 'Client', equipe: 'Équipe', role: 'Rôle' };

function element(tag, text, parent) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
}

function button(label, parent, action) {
    const node = element('button', label, parent);
    node.type = 'button';
    node.onclick = action;
    return node;
}

function field(parent, key, label, value = '', multiline = false) {
    const wrapper = element('label', label, parent);
    const input = element(multiline ? 'textarea' : 'input', null, wrapper);
    input.dataset.key = key;
    input.value = value ?? '';
    if (multiline) input.rows = 5;
    return input;
}

function fields(parent, labels, data = {}) {
    for (const [key, label] of Object.entries(labels)) field(parent, key, label, data[key]);
}

function readFields(parent) {
    return Object.fromEntries([...parent.querySelectorAll('[data-key]')].map(input => [input.dataset.key, input.value]));
}

function lines(text) {
    return text.split('\n').map(value => value.trim()).filter(Boolean);
}

function listEditor(parent, id, title, labels, rows) {
    element('h2', title, parent);
    const container = element('div', null, parent);
    container.id = id;
    rows.forEach(row => addRow(container, labels, row));
    button('Ajouter', parent, () => addRow(container, labels, {}));
}

function addRow(container, labels, row, project = false) {
    const block = element('fieldset', null, container);
    if (row.id) block.dataset.id = row.id;
    fields(block, labels, row);
    if (project) {
        field(block, 'missions', 'Missions — une par ligne', (row.missions || []).join('\n'), true);
        field(block, 'technologies', 'Technologies — une par ligne', (row.technologies || []).join('\n'), true);
    }
    button('Retirer', block, () => block.remove());
}

function readRows(id, project = false) {
    return [...$(id).children].map(block => {
        const row = readFields(block);
        if (block.dataset.id) row.id = Number(block.dataset.id);
        if (project) { row.missions = lines(row.missions); row.technologies = lines(row.technologies); }
        return row;
    });
}

async function api(path, method = 'GET', body) {
    const res = await fetch(API_URL + path, { method, headers: { 'Authorization': `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (res.status === 401 || res.status === 403) { logout(); throw new Error('Session expirée ou identifiants incorrects.'); }
    if (!res.ok) throw new Error((await res.json()).message || 'La requête a échoué.');
    return res;
}

function logout() {
    token = null;
    sessionStorage.removeItem('cv-admin-token');
    $('admin-view').classList.add('hidden');
    $('experienceModal').classList.add('hidden');
    $('login-view').classList.remove('hidden');
}

function showError(error) { alert(error.message || 'Erreur de connexion.'); }

async function login(event) {
    event.preventDefault();
    try {
        const res = await api('/login', 'POST', { email: $('email').value, password: $('password').value });
        token = (await res.json()).token;
        sessionStorage.setItem('cv-admin-token', token);
        $('password').value = '';
        await loadCv();
    } catch (error) { showError(error); }
}

function renderCvFields() {
    const parent = $('cvFields');
    parent.replaceChildren();
    element('h2', 'Informations personnelles et profil', parent);
    const infos = element('div', null, parent); infos.id = 'infoFields'; fields(infos, infoLabels, currentCv.infos);
    field(parent, 'profil', 'Présentation professionnelle', currentCv.profil, true).id = 'profileField';
    element('h2', 'Compétences', parent);
    const skills = element('div', null, parent); skills.id = 'skillFields';
    for (const [key, label] of Object.entries(skillLabels)) field(skills, key, label + ' — une par ligne', (currentCv.competences[key] || []).join('\n'), true);
    listEditor(parent, 'formationRows', 'Formation', { etab: 'Établissement', periode: 'Période', diplome: 'Diplôme' }, currentCv.formation);
    listEditor(parent, 'languageRows', 'Langues', { langue: 'Langue', niveau: 'Niveau' }, currentCv.langues);
    field(parent, 'certificats', 'Certifications — une par ligne', currentCv.certificats.join('\n'), true).id = 'certificateField';
    field(parent, 'centresInteret', 'Centres d’intérêt — un par ligne', currentCv.centresInteret.join('\n'), true).id = 'interestField';
}

function renderExperiences() {
    const tbody = $('experiencesTable').querySelector('tbody');
    tbody.replaceChildren();
    currentCv.experiences.forEach(exp => {
        const row = element('tr', null, tbody);
        for (const key of ['poste', 'entreprise', 'periode']) element('td', exp[key], row);
        const actions = element('td', null, row); actions.className = 'actions';
        button('Modifier', actions, () => openExperience(exp));
        button('Supprimer', actions, () => deleteExperience(exp.id)).className = 'btn-delete';
    });
}

async function loadCv() {
    currentCv = await (await api('/cv')).json();
    $('login-view').classList.add('hidden');
    $('admin-view').classList.remove('hidden');
    renderCvFields();
    renderExperiences();
    await loadBackups();
}

async function saveCv(event) {
    event.preventDefault();
    const competences = Object.fromEntries(Object.entries(readFields($('skillFields'))).map(([key, value]) => [key, lines(value)]));
    try {
        await api('/cv', 'PUT', { infos: readFields($('infoFields')), profil: $('profileField').value, competences,
            formation: readRows('formationRows'), langues: readRows('languageRows'),
            certificats: lines($('certificateField').value), centresInteret: lines($('interestField').value) });
        await loadCv();
        alert('Informations enregistrées et sauvegardées.');
    } catch (error) { showError(error); }
}

function openExperience(exp = {}) {
    currentExpId = exp.id || null;
    $('modalTitle').textContent = exp.id ? 'Modifier l’expérience' : 'Ajouter une expérience';
    const parent = $('experienceFields'); parent.replaceChildren(); fields(parent, expLabels, exp);
    field(parent, 'missions', 'Missions — une par ligne', (exp.missions || []).join('\n'), true);
    field(parent, 'technologies', 'Technologies — une par ligne', (exp.technologies || []).join('\n'), true);
    $('projectList').replaceChildren();
    (exp.projets || []).forEach(addProject);
    $('experienceModal').classList.remove('hidden');
}

function addProject(project = {}) {
    addRow($('projectList'), { titre: 'Titre du sous-projet', contexte: 'Contexte', equipe: 'Équipe', role: 'Rôle' }, project, true);
}

async function saveExperience(event) {
    event.preventDefault();
    const data = readFields($('experienceFields'));
    data.missions = lines(data.missions); data.technologies = lines(data.technologies); data.projets = readRows('projectList', true);
    try {
        await api(currentExpId ? `/experiences/${currentExpId}` : '/experiences', currentExpId ? 'PUT' : 'POST', data);
        $('experienceModal').classList.add('hidden');
        await loadCv();
    } catch (error) { showError(error); }
}

async function deleteExperience(id) {
    if (!confirm('Supprimer cette expérience ? Une sauvegarde permettra de la restaurer.')) return;
    try { await api(`/experiences/${id}`, 'DELETE'); await loadCv(); } catch (error) { showError(error); }
}

async function loadBackups() {
    const backups = await (await api('/backups')).json();
    $('backupList').replaceChildren();
    backups.forEach(backup => {
        const option = element('option', `${backup.created_at} — ${backup.reason}`, $('backupList'));
        option.value = backup.id;
    });
}

async function download(path) {
    try {
        const res = await api(path);
        const url = URL.createObjectURL(await res.blob());
        const link = element('a'); link.href = url;
        link.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'data-backup.json';
        link.click(); URL.revokeObjectURL(url);
    } catch (error) { showError(error); }
}

async function restore() {
    if (!confirm('Restaurer ce CV ? Les données actuelles seront sauvegardées avant leur remplacement.')) return;
    try { await api(`/backups/${$('backupList').value}/restore`, 'POST'); await loadCv(); } catch (error) { showError(error); }
}

$('loginForm').onsubmit = login;
$('logoutButton').onclick = logout;
$('cvForm').onsubmit = saveCv;
$('addExperience').onclick = () => openExperience();
$('closeModal').onclick = () => $('experienceModal').classList.add('hidden');
$('addProject').onclick = () => addProject();
$('experienceForm').onsubmit = saveExperience;
$('exportButton').onclick = () => download('/export');
$('downloadBackup').onclick = () => download(`/backups/${$('backupList').value}`);
$('restoreBackup').onclick = restore;
if (token) loadCv().catch(showError);
