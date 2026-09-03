import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

// Detect if Vercel / .env has the Firestore database ID placed into VITE_FIREBASE_PROJECT_ID
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const isEnvProjectIdDatabaseId = Boolean(
  envProjectId && (envProjectId.startsWith('ai-studio-') || envProjectId.includes('monthlycommitmen'))
);

// Resolve actual GCP Project ID:
// If VITE_FIREBASE_PROJECT_ID was set to the database name (ai-studio-monthlycommitmen-...),
// we auto-correct it to the true GCP Project ID from firebase-applet-config.json.
const projectId = (isEnvProjectIdDatabaseId || !envProjectId)
  ? (firebaseConfig.projectId || 'gen-lang-client-0183206589')
  : envProjectId;

// Resolve Firestore Database ID:
const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  (isEnvProjectIdDatabaseId ? envProjectId : firebaseConfig.firestoreDatabaseId) ||
  'ai-studio-monthlycommitmen-0099a18a-0c19-421b-841c-147e66e22a6a';

// Resolve Auth Domain
const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const authDomain = (!rawAuthDomain || rawAuthDomain.includes('ai-studio-'))
  ? (firebaseConfig.authDomain || `${projectId}.firebaseapp.com`)
  : rawAuthDomain;

// Resolve Storage Bucket
const rawStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const storageBucket = (!rawStorageBucket || rawStorageBucket.includes('ai-studio-'))
  ? (firebaseConfig.storageBucket || `${projectId}.firebasestorage.app`)
  : rawStorageBucket;

// Resolve Messaging Sender ID
const rawSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const messagingSenderId = (!rawSenderId || rawSenderId === '111123842180')
  ? (firebaseConfig.messagingSenderId || '735504375917')
  : rawSenderId;

// Resolve App ID
const rawAppId = import.meta.env.VITE_FIREBASE_APP_ID;
const appId = (!rawAppId || rawAppId.includes('111123842180'))
  ? (firebaseConfig.appId || '1:735504375917:web:b76b679244752957d7df64')
  : rawAppId;

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || 'AIzaSyDGVjiYjbDaSJCTraaCQTqgHV8xOpjC5zo';

const resolvedConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

if (typeof window !== 'undefined') {
  console.log(`[Firebase] Initialized with Project: ${projectId}, Database: ${firestoreDatabaseId}`);
  if (isEnvProjectIdDatabaseId) {
    console.warn(`[Firebase Notice] Detected Database ID in VITE_FIREBASE_PROJECT_ID. Auto-corrected Project ID to '${projectId}' and Database ID to '${firestoreDatabaseId}'.`);
  }
}

const app = getApps().length === 0 ? initializeApp(resolvedConfig) : getApp();

export const db = firestoreDatabaseId && firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

