import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCbk-Aega3pmyKL6E38irzvVxPxEApVxZM",
  authDomain: "teamup-5a2da.firebaseapp.com",
  projectId: "teamup-5a2da",
  storageBucket: "teamup-5a2da.firebasestorage.app",
  messagingSenderId: "99379718294",
  appId: "1:99379718294:web:de2e9e1db0404c63537ab7"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);