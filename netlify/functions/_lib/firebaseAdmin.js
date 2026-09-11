const admin = require('firebase-admin');

// Reused across all admin-backed functions in this folder. The service
// account key is stored as a Netlify environment variable (base64-encoded
// JSON), never committed to the repo.
function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!encoded) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 environment variable is not set.');
  }

  const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function getDb() {
  getAdminApp();
  return admin.firestore();
}

module.exports = { admin, getAdminApp, getDb };
