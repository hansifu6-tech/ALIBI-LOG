import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCFo7jNiV3oo6xmL9Chn54awgq2zYbh9nA",
  authDomain: "alibi-calendar-ac07c.firebaseapp.com",
  projectId: "alibi-calendar-ac07c",
  storageBucket: "alibi-calendar-ac07c.firebasestorage.app",
  messagingSenderId: "833804167211",
  appId: "1:833804167211:web:c7fb3eaa0d4698c346e26e",
  measurementId: "G-F6BQ5VEXCV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
