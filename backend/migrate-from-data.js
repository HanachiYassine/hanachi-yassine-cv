// Import explicite avec sauvegarde ; les comptes administrateurs sont conservés.
process.argv[2] ||= require('path').join(__dirname, 'data.json');
require('./scripts/restore');
