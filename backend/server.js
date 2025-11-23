const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const cvService = require('./cv.service');
const auth = require('./auth');
const adminExperiencesRoutes = require('./admin-experiences.routes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API to serve CV data from DB
app.get('/api/cv', async (req, res) => {
    try {
        const data = await cvService.getCvData();
        res.json(data);
    } catch (error) {
        console.error('Error fetching CV data:', error);
        res.status(500).send('Error fetching CV data');
    }
});

// Auth Routes
app.use('/api/admin', auth.router);

// Admin Experience Routes
app.use('/api/admin/experiences', adminExperiencesRoutes);

// API to generate PDF using EJS template
app.get('/api/pdf', async (req, res) => {
    try {
        console.log('Generating PDF from backend template...');
        const cvData = await cvService.getCvData();

        // Read profile image and convert to base64
        const imagePath = path.join(__dirname, '../src/assets/cv-profile.jpeg');
        let photoBase64 = '';
        try {
            if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                photoBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
            } else {
                console.warn('Profile image not found at:', imagePath);
            }
        } catch (err) {
            console.warn('Error reading profile image:', err.message);
        }

        const templatePath = path.join(__dirname, 'template.ejs');
        const template = fs.readFileSync(templatePath, 'utf8');

        // Render HTML with data
        const html = ejs.render(template, { ...cvData, photoBase64 });

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set the content
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            }
        });

        await browser.close();

        res.contentType('application/pdf');
        res.send(pdf);
        console.log('PDF generated successfully.');

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).send('Error generating PDF');
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
