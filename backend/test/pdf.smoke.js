const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-pdf-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.SQLITE_PATH = path.join(directory, 'cv.db');
const db = require('../db');
const { escapeXML } = require('ejs');
const { getCvData } = require('../cv.service');
after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
test('le HTML du PDF contient les mêmes expériences et missions que l’API', async () => {
    const data = await getCvData();
    const html = await require('../pdf.service').renderHtml();
    let previous = -1;
    for (const exp of data.experiences) {
        const position = html.indexOf(escapeXML(exp.entreprise), previous + 1);
        assert.ok(position > previous, `Ordre du PDF : ${exp.entreprise}`);
        previous = position;
        assert.ok(html.includes(escapeXML(exp.periode)));
        for (const mission of exp.missions) assert.ok(html.includes(escapeXML(mission)));
    }
});
test('génération réelle du PDF A4 avec Puppeteer', async () => {
    await db.ready;
    const result = await require('../pdf.service').generatePdf();
    assert.equal(Buffer.from(result).subarray(0, 5).toString(), '%PDF-');
    assert.ok(result.byteLength > 10000);
});
