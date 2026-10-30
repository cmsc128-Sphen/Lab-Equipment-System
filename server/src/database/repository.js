const { FieldValue, FieldPath } = require('firebase-admin/firestore');

function validateId(id) {
    const isInvalid = typeof id !== 'string'
        || !id.trim()
        || id.includes('/')
        || id === '.'
        || id === '..';

    if (isInvalid) {
        throw new TypeError('Document ID must be a nonempty single path segment.');
    }
}

function validateData(data) {
    const isInvalid = !data
        || Object.getPrototypeOf(data) !== Object.prototype
        || !Object.keys(data).length;

    if (isInvalid) {
        throw new TypeError('Data must be a nonempty plain object.');
    }

    const managedFields = ['id', 'createdAt', 'updatedAt'];

    for (const fieldName of Object.keys(data)) {
        if (!fieldName || fieldName.includes('.') || managedFields.includes(fieldName)) {
            throw new TypeError('Use ordinary top-level fields; id and timestamps are managed by the repository.');
        }
    }
}

// Internal helpers only. Feature services handle authentication and business rules.
function createRepository(database, collectionPath) {
    if (typeof collectionPath !== 'string') {
        throw new TypeError('Collection path must be a string.');
    }

    const pathSegments = collectionPath.split('/');

    if (pathSegments.length % 2 !== 1) {
        throw new TypeError('Collection path must end at a collection.');
    }

    pathSegments.forEach(validateId);

    const collection = database.collection(collectionPath);

    // Keep operation logs consistent without logging document contents or credentials.
    async function run(operation, action) {
        // INFO before the database request; operation identifies the attempted action.
        console.log(`[INFO] database.operation_started operation=${operation}`);

        try {
            const result = await action();
            const outcome = result === null ? 'not_found' : 'ok';

            // INFO after the request succeeds; outcome distinguishes a missing read.
            console.log(`[INFO] database.operation_completed operation=${operation} result=${outcome}`);

            return result;
        } catch (error) {
            // ERROR on failure; propagate the error without printing raw SDK messages.
            console.error(`[ERROR] database.operation_failed operation=${operation} nextAction=propagate_to_caller`);

            throw error;
        }
    }

    return {
        async create(data, id) {
            validateData(data);

            if (id !== undefined) {
                validateId(id);
            }

            return run('create', async () => {
                const documentReference = id === undefined
                    ? collection.doc()
                    : collection.doc(id);

                // create() rejects an existing ID instead of overwriting its record.
                await documentReference.create({
                    ...data,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });

                return { id: documentReference.id };
            });
        },

        async getById(id) {
            validateId(id);

            return run('read', async () => {
                const documentReference = collection.doc(id);
                const documentSnapshot = await documentReference.get();

                if (!documentSnapshot.exists) {
                    return null;
                }

                return {
                    id: documentSnapshot.id,
                    data: documentSnapshot.data(),
                };
            });
        },

        async list({ limit = 25, afterId } = {}) {
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new RangeError('Limit must be an integer between 1 and 100.');
            }

            if (afterId !== undefined) {
                validateId(afterId);
            }

            return run('list', async () => {
                let query = collection.orderBy(FieldPath.documentId());

                if (afterId !== undefined) {
                    query = query.startAfter(afterId);
                }

                const querySnapshot = await query.limit(limit).get();
                const records = querySnapshot.docs.map((documentSnapshot) => ({
                    id: documentSnapshot.id,
                    data: documentSnapshot.data(),
                }));

                const nextCursor = records.length === limit
                    ? records.at(-1).id
                    : null;

                return { records, nextCursor };
            });
        },

        async update(id, changes) {
            validateId(id);
            validateData(changes);

            return run('update', async () => {
                const documentReference = collection.doc(id);

                // Reject missing records. Supplied nested maps replace the existing maps.
                await documentReference.update({
                    ...changes,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                return { id };
            });
        },

        async delete(id) {
            validateId(id);

            return run('delete', async () => {
                const documentReference = collection.doc(id);

                // Idempotent single-document delete; subcollections and files remain.
                await documentReference.delete();

                return { id };
            });
        },
    };
}

module.exports = { createRepository };
