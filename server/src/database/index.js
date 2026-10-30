const { getDatabase } = require('../config/firebase');
const { createRepository } = require('./repository');
const collections = require('./collections');

function getRepository(collectionPath) {
    const database = getDatabase();

    return createRepository(database, collectionPath);
}

module.exports = {
    getDatabase,
    getRepository,
    createRepository,
    collections,
};
