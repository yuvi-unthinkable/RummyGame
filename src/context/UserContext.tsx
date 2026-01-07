import React, { createContext, useState, useEffect, useContext } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// 1. Define your User type to include Firebase UID
export type UserProfile = {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
};

const UserContext = createContext<{
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}>({ user: null, loading: true, logout: async () => {} });

export const UserProvider = ({ children }: any) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listens to the ACTUAL Firebase Auth state
    const unsubscribe = auth().onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        // If Firebase says we have a user, fetch their extra details (firstName, etc.)
        // You can get this from Firestore or your custom storage
        const userDoc = await firestore()
          .collection('users')
          .doc(firebaseUser.uid)
          .get();

        if (userDoc.exists) {
          const data = userDoc.data();
          setUser({
            uid: firebaseUser.uid,
            firstName: data?.firstName || '',
            lastName: data?.lastName || '',
            email: firebaseUser.email || '',
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await auth().signOut(); // This clears BOTH the Firebase state and triggers the listener
  };

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
