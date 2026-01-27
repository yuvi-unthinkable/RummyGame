import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useContext, useEffect, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { UserContext } from '../context/UserContext';
import { RootStackParamList } from '../navigators/types';
import { handleLogin } from '../database/UserServices';
import { useUser } from '../context/UserContext';


type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function Login() {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation<NavigationProp>();
  const { setUser } = useUser(); // Get the setter from context
  

  const handleLogin1 = async () => {
    if (!email || !password) {
      Alert.alert('error', 'Please enter email and password');
      return;
    }

    const user = await handleLogin(email, password);

    if (!user) {
      Alert.alert('Error', 'Invalid Credentials');
      return;
    }
    setUser(user)
    navigation.navigate('Home')
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>Rummy Game</Text>

      <View style={styles.formContainer}>
        <Text style={styles.heading}>Welcome back 👋</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="Enter your email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="Enter your password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
        </View>
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin1}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signupContainer}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.signupText}>
            Don't have an account? <Text style={styles.signupLink}>Signup</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a73e8',
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 4, // shadow for Android
    shadowColor: '#000', // shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  loginBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  signupContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  signupText: {
    fontSize: 15,
    color: '#555',
  },
  signupLink: {
    color: '#1a73e8',
    fontWeight: '600',
  },
});
