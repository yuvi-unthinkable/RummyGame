import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';

// Your Context
// import { UserProvider, useUser } from './context/UserContext';

// Your Screens
import Signup from './src/Components/Signup';
import Login from './src/Components/Login';
import Playground from './src/Components/Playground';
import { UserProvider, useUser } from './src/context/UserContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootStackParamList } from './src/navigators/types';
import Home from './src/Components/Home';

const Stack = createNativeStackNavigator();

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'App'>;


// 1. Define the Auth Stack (Logged Out)
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen name="Login" component={Login} />
    <Stack.Screen name="SignUp" component={Signup} />
  </Stack.Navigator>
);

// 2. Define the Game Stack (Logged In)
const GameStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home" component={Home} />
    <Stack.Screen name="Playground" component={Playground} />
  </Stack.Navigator>
);

// 3. The Logic Controller
const RootNavigator = () => {
  const { user, loading } = useUser();
  // console.log("🚀 ~ RootNavigator ~ user:", user)

  // IMPORTANT: This prevents the 'null' flash while Firebase is waking up
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
      <NavigationContainer>
      {user ? <GameStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

// 4. The Main App Entry Point
function App() {
  return (
     <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        <RootNavigator />
      </UserProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
