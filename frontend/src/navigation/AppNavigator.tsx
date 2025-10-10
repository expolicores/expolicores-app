// src/navigation/AppNavigator.tsx
import React from "react";
import {
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

// Screens (auth)
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

// Screens (perfil / direcciones / producto / carrito / pedidos / checkout)
import ProfileScreen from "../screens/ProfileScreen";
import AddressListScreen from "../screens/AddressListScreen";
import AddressFormScreen from "../screens/AddressFormScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CartScreen from "../screens/CartScreen";
import MyOrdersScreen from "../screens/MyOrdersScreen";
import AdminOrdersScreen from "../screens/AdminOrdersScreen";
import OrderTrackingScreen from "../screens/OrderTrackingScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import OrderSuccessScreen from "../screens/OrderSuccessScreen";

// Screens (home / market / restaurantes placeholder)
import HomeScreen from "../screens/HomeScreen";
import MarketScreen from "../screens/MarketScreen";
import RestaurantsPlaceholderScreen from "../screens/RestaurantsPlaceholderScreen";

// Botón con puntico de órdenes activas
import OrdersButton from "../components/OrdersButton";

/** ---------------- Feature flags ---------------- **/
const RESTAURANTS_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_RESTAURANTS || "false") === "true";

/** ---------------- Placeholder Bodega ---------------- **/
function BodegaPlaceholderScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "800", color: "#111" }}>
        Bodega Virtual
      </Text>
      <Text style={{ marginTop: 8, color: "#666", textAlign: "center" }}>
        Sección mayorista (solo negocios). Próximamente.
      </Text>
    </View>
  );
}

/** ---------------- Tipos de navegación ---------------- **/
export type AddressStackParamList = {
  AddressList: undefined;
  AddressForm: { addressId?: number } | undefined;
};

export type RootStackParamList = {
  // No-auth
  Login: undefined;
  Register: undefined;

  // Auth (Home + módulos)
  Home: undefined;
  Market: undefined;
  RestaurantsPlaceholder?: undefined; // se registrará solo con flag
  Bodega: undefined;

  // Alias legacy (Catalog -> Market)
  Catalog: undefined;

  // Producto
  ProductDetail: { id: number };

  // Perfil
  Profile: undefined;

  // Carrito
  Cart: undefined;

  // Direcciones (stack anidado / modal)
  Addresses: NavigatorScreenParams<AddressStackParamList>;

  // Pedidos
  MyOrders: undefined;
  AdminOrders: undefined;
  OrderTracking: { orderId: number };

  // Compra
  Checkout: undefined;
  OrderSuccess: { orderId: number; total: number };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AddressStack = createNativeStackNavigator<AddressStackParamList>();

/** ---------------- Header Buttons ---------------- **/
function HeaderCartButton({ onPress }: { onPress: () => void }) {
  const { count } = useCart();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ver carrito"
      style={{ paddingHorizontal: 6 }}
    >
      <View style={{ position: "relative" }}>
        <Ionicons name="cart-outline" size={22} color="#111" />
        {count > 0 && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -8,
              backgroundColor: "#ef4444",
              borderRadius: 999,
              paddingHorizontal: 5,
              paddingVertical: 1,
              minWidth: 18,
              alignItems: "center",
              justifyContent: "center",
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

function HeaderProfileButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Mi perfil"
      style={{ paddingHorizontal: 6 }}
    >
      <Ionicons name="person-circle-outline" size={24} color="#111" />
    </Pressable>
  );
}

/** ---------------- Stack anidado: Direcciones ---------------- **/
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

/** ---------------- App Navigator ---------------- **/
export default function AppNavigator() {
  const { booting, isAuthenticated, user } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
    }

  const headerRightCommon = (navigation: any) => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {user?.role === "ADMIN" ? (
        <Pressable
          onPress={() => navigation.navigate("AdminOrders")}
          accessibilityRole="button"
          accessibilityLabel="Administrar pedidos"
          style={{ paddingHorizontal: 6 }}
        >
          <Ionicons name="clipboard-outline" size={22} color="#111" />
        </Pressable>
      ) : null}
      <OrdersButton />
      <HeaderCartButton onPress={() => navigation.navigate("Cart")} />
      <HeaderProfileButton onPress={() => navigation.navigate("Profile")} />
    </View>
  );

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <RootStack.Navigator initialRouteName="Home">
          {/* HOME */}
          <RootStack.Screen
            name="Home"
            component={HomeScreen}
            options={({ navigation }) => ({
              title: "Inicio",
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* MARKET (catálogo nuevo) */}
          <RootStack.Screen
            name="Market"
            component={MarketScreen}
            options={({ navigation }) => ({
              title: "Mercado",
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* LEGACY: Catalog -> Market */}
          <RootStack.Screen
            name="Catalog"
            component={MarketScreen}
            options={({ navigation }) => ({
              title: "Mercado",
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* RESTAURANTES (registrar SOLO si el flag está ON) */}
          {RESTAURANTS_ENABLED && (
            <RootStack.Screen
              name="RestaurantsPlaceholder"
              component={RestaurantsPlaceholderScreen}
              options={({ navigation }) => ({
                title: "Restaurantes",
                headerRight: () => headerRightCommon(navigation),
              })}
            />
          )}

          {/* BODEGA VIRTUAL (placeholder o real si ya lo tienes) */}
          <RootStack.Screen
            name="Bodega"
            component={BodegaPlaceholderScreen}
            options={({ navigation }) => ({
              title: "Bodega Virtual",
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* PRODUCTO / PERFIL / CARRITO */}
          <RootStack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={({ navigation }) => ({
              title: "Detalle",
              headerRight: () => headerRightCommon(navigation),
            })}
          />
          <RootStack.Screen
            name="Cart"
            component={CartScreen}
            options={{ title: "Carrito" }}
          />
          <RootStack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: "Perfil" }}
          />

          {/* DIRECCIONES (modal con stack anidado) */}
          <RootStack.Screen
            name="Addresses"
            component={AddressesNavigator}
            options={{ headerShown: false, presentation: "modal" }}
          />

          {/* PEDIDOS */}
          <RootStack.Screen
            name="MyOrders"
            component={MyOrdersScreen}
            options={{ title: "Mis pedidos" }}
          />
          <RootStack.Screen
            name="AdminOrders"
            component={AdminOrdersScreen}
            options={({ navigation }) => ({
              title: "Pedidos (Admin)",
              headerRight: () => headerRightCommon(navigation),
            })}
          />
          <RootStack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ title: "Estado del pedido" }}
          />

          {/* CHECKOUT */}
          <RootStack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ title: "Checkout" }}
          />
          <RootStack.Screen
            name="OrderSuccess"
            component={OrderSuccessScreen}
            options={{ title: "Pedido creado" }}
          />
        </RootStack.Navigator>
      ) : (
        <RootStack.Navigator initialRouteName="Login">
          <RootStack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: "Crear cuenta" }}
          />
        </RootStack.Navigator>
      )}
    </NavigationContainer>
  );
}


