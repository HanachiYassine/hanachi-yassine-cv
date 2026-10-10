const serverless = require('serverless-http');
process.env.CV_SERVERLESS = 'true';
process.env.CV_GIT_COMMIT = require('../commit.json').commit;
if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_PROVIDER = 'turso';
}
const db = require('../../db');
const handleRequest = serverless(require('../../server'), { binary: ['application/pdf'] });

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await db.ready;
    return handleRequest(event, context);
};
