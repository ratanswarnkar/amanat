const admin = require('firebase-admin');

const getPrivateKey = () => {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return null;
  // Allow passing multiline key via env with \n
  return raw.replace(/\\n/g, '\n');
};

const initFirebaseAdmin = () => {
  if (admin.apps?.length) {
    return admin.app();
  }

  // Prefer explicit service account env vars (recommended for production).
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  // Fallback: GOOGLE_APPLICATION_CREDENTIALS / application default credentials.
  // This is convenient for local dev, but production should use env vars above.
  if (process.env.NODE_ENV === 'production') {
    const error = new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
    error.statusCode = 500;
    throw error;
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
};

module.exports = {
  admin,
  initFirebaseAdmin,
};

