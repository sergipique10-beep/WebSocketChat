import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCyUqUmhKdNEMVeORwgGAqScutiqCAmAKI",
  authDomain: "chatws-f4c3e.firebaseapp.com",
  projectId: "chatws-f4c3e",
  storageBucket: "chatws-f4c3e.firebasestorage.app",
  messagingSenderId: "419695132466",
  appId: "1:419695132466:web:0f8ad1ea7fc0e7da1f612b",
  measurementId: "G-FKB7JL387S"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
