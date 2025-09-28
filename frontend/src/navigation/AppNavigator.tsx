// src/navigation/AppNavigator.tsx
import React from "react";
import { NavigationContainer, NavigatorScreenParams } from "@react-navigation/native";
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
import MyOrdersScreen from "../screens/MyOrdersScreen";
import OrderTrackingScreen from "../screens/OrderTrackingScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import OrderSuccessScreen from "../screens/OrderSuccessScreen";

// --- Tipos de navegación ---
export type AddressStackParamList = {
  AddressList: undefined;
  AddressForm: { addressId?: number } | undefined;
};

export type RootStackParamList = {
  // No-auth
  Login: undefined;
  Register: undefined;

  // Auth
  Catalog: undefined;
  ProductDetail: { id: number };
  Profile: undefined;
  Cart: undefined;

  // Direcciones como stack anidado/modal
  Addresses: NavigatorScreenParams<AddressStackParamList>;

  // Pedidos
  MyOrders: undefined;
  OrderTracking: { orderId: number };

  // Compra
  Checkout: undefined;
  OrderSuccess: { orderId: number; total: number };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AddressStack = createNativeStackNavigator<AddressStackParamList>();

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
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// Botón “Mis pedidos”
function HeaderOrdersButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Mis pedidos">
      <View style={{ paddingHorizontal: 6 }}>
        <Text style={{ fontSize: 20 }}>🧾</Text>
      </View>
    </Pressable>
  );
}

// --- Stack anidado para Direcciones ---
function AddressesNavigator() {
  return (
    <AddressStack.Navigator>
      <AddressStack.Screen
        name="AddressList"
        component={AddressListScreen}
        options={{ title: "Mis direcciones" }}
      />
      <AddressStack.Screen
        name="AddressForm"
        component={AddressFormScreen}
        options={{ title: "Nueva dirección" }}
      />
    </AddressStack.Navigator>
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
        <RootStack.Navigator initialRouteName="Catalog">
          <RootStack.Screen
            name="Catalog"
            component={CatalogScreen}
            options={({ navigation }) => ({
              title: "Catálogo",
              headerRight: () => (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Mis pedidos */}
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

          <RootStack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={({ navigation }) => ({
              title: "Detalle",
              headerRight: () => (
                <HeaderCartButton onPress={() => navigation.navigate("Cart")} />
              ),
            })}
          />

          <RootStack.Screen name="Cart" component={CartScreen} options={{ title: "Carrito" }} />

          {/* Direcciones como modal con stack anidado */}
          <RootStack.Screen
            name="Addresses"
            component={AddressesNavigator}
            options={{ headerShown: false, presentation: "modal" }}
          />

          {/* Pedidos */}
          <RootStack.Screen
            name="MyOrders"
            component={MyOrdersScreen}
            options={{ title: "Mis pedidos" }}
          />
          <RootStack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ title: "Estado del pedido" }}
          />

          {/* Flujo de compra */}
          <RootStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
          <RootStack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ title: "Pedido creado" }} />

          <RootStack.Screen name="Profile" component={ProfileScreen} />
        </RootStack.Navigator>
      ) : (
        <RootStack.Navigator initialRouteName="Login">
          <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="Register" component={RegisterScreen} options={{ title: "Crear cuenta" }} />
        </RootStack.Navigator>
      )}
    </NavigationContainer>
  );
}
