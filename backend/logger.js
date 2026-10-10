function error(message, failure) {
    process.stderr.write(message + ': ' + (failure?.stack || 'Erreur interne') + '\n');
}

module.exports = { error };
