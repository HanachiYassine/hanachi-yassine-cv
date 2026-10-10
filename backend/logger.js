function info(message, details) {
    process.stdout.write(message + ': ' + JSON.stringify(details) + '\n');
}

function error(message, failure) {
    process.stderr.write(message + ': ' + (failure?.stack || 'Erreur interne') + '\n');
}

module.exports = { info, error };
