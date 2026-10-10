function route(handler) {
    return (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next);
}

function downloadJson(res, data, filename) {
    res.set('Cache-Control', 'no-store');
    res.attachment(filename).type('application/json').send(JSON.stringify(data, null, 2));
}

module.exports = { route, downloadJson };
