import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

// Initialize Firebase (SSR safe check)
const app = hasFirebaseConfig ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

if (auth && typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => undefined);
}

// Initialize Analytics (SSR safe check)
let analytics: Analytics | null = null;
if (app && typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => undefined);
}

export { app, db, auth, analytics, hasFirebaseConfig };
