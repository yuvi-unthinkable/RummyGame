import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { useEffect } from 'react';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app); // Get the Realtime Database instance

const writeToFirebase = async () => {


  try {
    // Use the 'set' function with a database reference
    await set(ref(database, 'users/user123'), {
      name: 'user2',
      age: 23,
      msg: 'hello babies lets have some fun together okaye',
    });
    console.log('Success: Data saved to Firebase!');
  } catch (error) {
    console.log('🚀 ~ writeToFirebase ~ error:', error);
  }
};

export function initDb() {
  writeToFirebase();
}
