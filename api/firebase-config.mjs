// Vercel Serverless Function: /api/firebase-config
// Returns the Firebase Realtime Database config from environment variables
// Set these in the Vercel dashboard (Project Settings → Environment Variables).
// Firebase config is meant to be PUBLIC - real security comes from RTDB rules.

export default function handler(req, res) {
  // Allow caching for 5 minutes since the config rarely changes.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.setHeader('Content-Type', 'application/json');

  const config = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  };

  // If any required field is missing, return 500 so client can show a clear error.
  const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
  const missing = required.filter((k) => !config[k]);
  if (missing.length > 0) {
    res.status(500).json({
      error: 'Firebase config is incomplete on the server',
      missing
    });
    return;
  }

  res.status(200).json(config);
}
