import { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes, onAuthStateChanged } from '@react-native-firebase/auth';

type UserContextType = {
  user: any | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
});

export const UserProvider = ({ children }: any) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged( firebaseUser => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
