import { getApp, getApps, initializeApp } from '@react-native-firebase/app';
import auth, { initializeAuth } from '@react-native-firebase/auth';
import database, { getDatabase } from '@react-native-firebase/database';
import firestore from '@react-native-firebase/firestore';



// Your Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: 'AIzaSyACF6eeAt5uMBwHm67-tiFem9xB5GmMemM',
  authDomain: 'rummygame-d8a27.firebaseapp.com',
  projectId: 'rummygame-d8a27', // Your project ID
  storageBucket: 'rummygame-d8a27.appspot.com',
  messagingSenderId: '965192341738',
  appId: '1:965192341738:android:f421c43161ee13f4cb5f93',
  databaseURL:
    'https://rummygame-d8a27-default-rtdb.asia-southeast1.firebasedatabase.app/', // Your database URL
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

console.log('🔥 Firebase Web SDK initialized');

export const db = getDatabase(app);
// export const auth = getAuth(app);

export { auth, firestore, database };
