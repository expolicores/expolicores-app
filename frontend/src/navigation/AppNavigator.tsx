// src/navigation/AppNavigator.tsx
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
import AddressFormScreen from "../screens/AddressFormScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CartScreen from "../screens/CartScreen";

// ✅ NUEVO
import MyOrdersScreen from "../screens/MyOrdersScreen";
import OrderTrackingScreen from "../screens/OrderTrackingScreen"; // 👈 NUEVO

import CheckoutScreen from "../screens/CheckoutScreen";
import OrderSuccessScreen from "../screens/OrderSuccessScreen";

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
  AddressForm: { addressId?: number } | undefined;
  Cart: undefined;

  // ✅ NUEVO
  MyOrders: undefined;
  OrderTracking: { orderId: number }; // 👈 NUEVO

  Checkout: undefined;
  OrderSuccess: { orderId: number; total: number };
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

// ✅ Botón “Mis pedidos” (emoji de recibo para no depender de libs)
function HeaderOrdersButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Mis pedidos">
      <View style={{ paddingHorizontal: 6 }}>
        <Text style={{ fontSize: 20 }}>🧾</Text>
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
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* 👉 Acceso directo a Mis pedidos */}
                  <HeaderOrdersButton onPress={() => navigation.navigate("MyOrders")} />

                  {/* Carrito */}
                  <HeaderCartButton onPress={() => navigation.navigate("Cart")} />

                  {/* Perfil (temporal para pruebas) */}
                  <Pressable onPress={() => navigation.navigate("Profile")} style={{ marginLeft: 12 }}>
                    <Text style={{ fontSize: 16 }}>👤</Text>
                  </Pressable>
                </View>
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

          <Stack.Screen name="Cart" component={CartScreen} options={{ title: "Carrito" }} />

          {/* Direcciones */}
          <Stack.Screen
            name="Addresses"
            component={AddressListScreen}
            options={{ title: "Mis direcciones" }}
          />
          <Stack.Screen
            name="AddressForm"
            component={AddressFormScreen}
            options={{ title: "Nueva dirección" }}
          />

          {/* ✅ Mis pedidos */}
          <Stack.Screen
            name="MyOrders"
            component={MyOrdersScreen}
            options={{ title: "Mis pedidos" }}
          />

          {/* ✅ Estado del pedido (tracking) */}
          <Stack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ title: "Estado del pedido" }}
          />

          {/* Checkout */}
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
          <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ title: "Pedido creado" }} />

          <Stack.Screen name="Profile" component={ProfileScreen} />
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
