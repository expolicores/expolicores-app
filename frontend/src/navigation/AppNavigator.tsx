import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import CatalogScreen from "../screens/CatalogScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AddressListScreen from "../screens/AddressListScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen"; // 👈 NUEVO

// --- Tipado del stack (opcional pero recomendado) ---
export type RootStackParamList = {
  // No-auth
  Login: undefined;
  Register: undefined;

  // Auth
  Catalog: undefined;
  ProductDetail: { id: number }; // 👈 NUEVO
  Profile: undefined;
  Addresses: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { booting, isAuthenticated } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator initialRouteName="Catalog">
          <Stack.Screen
            name="Catalog"
            component={CatalogScreen}
            options={{ title: "Catálogo" }}
          />
          <Stack.Screen
            name="ProductDetail"               // 👈 NUEVO
            component={ProductDetailScreen}
            options={{ title: "Detalle" }}
          />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Addresses" component={AddressListScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Crear cuenta" }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
