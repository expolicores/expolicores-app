import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import CatalogScreen from "../screens/CatalogScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AddressListScreen from "../screens/AddressListScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CartScreen from "../screens/CartScreen"; // 👈 NUEVO

// --- Tipado del stack ---
export type RootStackParamList = {
  // No-auth
  Login: undefined;
  Register: undefined;

  // Auth
  Catalog: undefined;
  ProductDetail: { id: number };
  Profile: undefined;
  Addresses: undefined;
  Cart: undefined;            // 👈 NUEVO
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HeaderCartButton({ onPress }: { onPress: () => void }) {
  const { count } = useCart();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Ver carrito">
      <View style={{ position: "relative", paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 20 }}>🛒</Text>
        {count > 0 && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              backgroundColor: "#ef4444",
              borderRadius: 999,
              paddingHorizontal: 5,
              paddingVertical: 1,
              minWidth: 18,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
              {count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

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
            options={({ navigation }) => ({
              title: "Catálogo",
              headerRight: () => (
                <HeaderCartButton onPress={() => navigation.navigate("Cart")} />
              ),
            })}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={({ navigation }) => ({
              title: "Detalle",
              headerRight: () => (
                <HeaderCartButton onPress={() => navigation.navigate("Cart")} />
              ),
            })}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ title: "Carrito" }}
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
