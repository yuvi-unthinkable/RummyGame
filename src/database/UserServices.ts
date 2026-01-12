import { Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth'; // Import globally

export const handleSignUp = async (
  username: string,
  email: string,
  password: string,
) => {
  try {
    // 1. Create user in Firebase Auth
    const userCredential = await auth().createUserWithEmailAndPassword(
      email,
      password,
    );
    const { uid } = userCredential.user;
    // 2. Store the username and extra data in Firestore
    await firestore().collection('users').doc(uid).set({
      username: username,
      email: email,
      chips: 1000, // Initial game chips
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    console.log('User account created & data stored!');
    return uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      Alert.alert('That email address is already in use!');
    }
    console.error(error);
  }
};

export const handleLogin = async (email: string, password: string) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(
      email,
      password,
    );

    const { uid } = userCredential.user;

    // Fetch the username from Firestore
    const userDoc = await firestore().collection('users').doc(uid).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('Welcome back, ' + userData?.username);

      return userData;
    }
  } catch (error) {
    Alert.alert('Invalid email or password');
  }
};
