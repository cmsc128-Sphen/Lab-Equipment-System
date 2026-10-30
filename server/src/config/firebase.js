const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let database;

function getDatabase() {
    if (database) {
        return database;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID is required. See server/.env.example.');
    }

    const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
    const mode = useEmulator ? 'emulator' : 'cloud';

    // INFO before SDK setup; mode distinguishes local emulation from cloud access.
    console.log(`[INFO] firebase.initialize mode=${mode}`);

    try {
        let firebaseApp = getApps().find((app) => app.name === 'les-database');

        if (!firebaseApp) {
            const firebaseOptions = { projectId };

            if (!useEmulator) {
                firebaseOptions.credential = applicationDefault();
            }

            firebaseApp = initializeApp(firebaseOptions, 'les-database');
        }

        database = getFirestore(firebaseApp);

        // INFO after client creation; this does not confirm remote connectivity.
        console.log('[INFO] firebase.client_initialized connectivity=not_checked');

        return database;
    } catch (error) {
        // ERROR for setup failure; omit credential-bearing SDK messages.
        console.error('[ERROR] firebase.initialize_failed nextAction=abort_startup');

        throw error;
    }
}

module.exports = { getDatabase };
