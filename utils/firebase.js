import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCks6RFyYcJPf_r48RCDpNzc_YuZfwp9Vs',
  authDomain: 'fitlife-2741f.firebaseapp.com',
  projectId: 'fitlife-2741f',
  storageBucket: 'fitlife-2741f.firebasestorage.app',
  messagingSenderId: '972031286539',
  appId: '1:972031286539:web:41d05871d9a210216f560e',
};

console.log('=== FIREBASE CONFIG ===', JSON.stringify(firebaseConfig));
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
