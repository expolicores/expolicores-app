import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressFormScreen from '../screens/AddressFormScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { initializing, user } = useContext(AuthContext);

  if (initializing) return null;

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen name="Perfil" component={ProfileScreen} />
          <Stack.Screen name="Direcciones" component={AddressListScreen} />
          <Stack.Screen name="Nueva dirección" component={AddressFormScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Registro" component={RegisterScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
