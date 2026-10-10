const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { getCvData } = require('./cv.service');
let busy = false;

async function renderHtml() {
    const imagePath = path.join(__dirname, '../src/assets/cv-profile.jpeg');
    const photoBase64 = fs.existsSync(imagePath) ? `data:image/jpeg;base64,${fs.readFileSync(imagePath).toString('base64')}` : '';
    const template = fs.readFileSync(path.join(__dirname, 'template.ejs'), 'utf8');
    return ejs.render(template, { ...await getCvData(), photoBase64 });
}

async function printPage(browser, html) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => /^(data:|about:)/.test(request.url()) ? request.continue() : request.abort());
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    return page.pdf({ format: 'A4', printBackground: true, timeout: 30000,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } });
}

async function generatePdf() {
    if (busy) { const error = new Error('Génération PDF en cours. Réessayez dans quelques secondes.'); error.status = 503; throw error; }
    busy = true;
    let browser;
    try {
        const html = await renderHtml();
        browser = await puppeteer.launch({ headless: true, timeout: 30000,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
        return await printPage(browser, html);
    } finally {
        try { if (browser) await browser.close(); } finally { busy = false; }
    }
}

module.exports = { generatePdf, renderHtml };
