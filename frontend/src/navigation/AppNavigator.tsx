// frontend/src/navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

import type { RootStackParamList, AddressStackParamList } from './types';

/** ===================== Screens (AUTH — OTP-first) ===================== **/
import AuthChooserScreen from '../screens/AuthChooserScreen';
import PhoneEntryScreen from '../screens/PhoneEntryScreen';
import OtpCodeScreen from '../screens/OtpCodeScreen';
import NameScreen from '../screens/NameScreen';
import EmailOptionalScreen from '../screens/EmailOptionalScreen';

/** ========== Screens (perfil / direcciones / producto / carrito / pedidos / checkout) ========== */
import ProfileScreen from '../screens/ProfileScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressFormScreen from '../screens/AddressFormScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import AdminOrdersScreen from '../screens/AdminOrdersScreen';
import AdminPriceListB2CScreen from '../screens/AdminPriceListB2CScreen';
import AdminPriceListB2BScreen from '../screens/AdminPriceListB2BScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import FavoritesScreen from '../screens/FavoritesScreen';

/** ========== Screens (market / restaurantes placeholder / bodega) ========== */
import MarketScreen from '../screens/MarketScreen';
import RestaurantsPlaceholderScreen from '../screens/RestaurantsPlaceholderScreen';
import BodegaScreen from '../screens/BodegaScreen';
import HomeScreen from '../screens/HomeScreen';

/** ========== Admin — Solicitudes B2B (nuevo) ========== */
import AdminBusinessApplicationsScreen from '../screens/AdminBusinessApplicationsScreen';

/** ================= Buttons en header ================= */
import OrdersButton from '../components/OrdersButton';
import FavoritesButton from '../components/FavoritesButton';

/** ---------------- Feature flags ---------------- **/
const RESTAURANTS_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_RESTAURANTS || 'false') === 'true';
const B2B_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_B2B || 'false') === 'true';

/** ---------------- Stacks tipados ---------------- **/
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AddressStack = createNativeStackNavigator<AddressStackParamList>();

/** ---------------- Header Buttons ---------------- **/
function HeaderCartButton({ onPress }: { onPress: () => void }) {
  const { count } = useCart();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 6 }}>
      <View style={{ position: 'relative' }}>
        <Ionicons name="cart-outline" size={22} color="#111" />
        {count > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              backgroundColor: '#ef4444',
              borderRadius: 999,
              paddingHorizontal: 5,
              paddingVertical: 1,
              minWidth: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function HeaderProfileButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 6 }}>
      <Ionicons name="person-circle-outline" size={24} color="#111" />
    </Pressable>
  );
}

/** ---------------- Stack anidado: Direcciones ---------------- **/
function AddressesNavigator() {
  return (
    <AddressStack.Navigator>
      <AddressStack.Screen
        name="Addresses"
        component={AddressListScreen}
        options={{ title: 'Mis direcciones' }}
      />
      <AddressStack.Screen
        name="AddressForm"
        component={AddressFormScreen}
        options={{ title: 'Nueva dirección' }}
      />
    </AddressStack.Navigator>
  );
}

/** ---------------- Gate post-auth: decide a dónde ir ---------------- **/
function PostAuthGate({ navigation }: any) {
  const { user, booting, isLoadingMe, emailDeferred, signOut } = useAuth();

  useEffect(() => {
    if (booting || isLoadingMe) return;

    if (!user) {
      signOut().catch(() => undefined);
      return;
    }

    // 1) Nombre primero
    const name = (user?.name ?? '').trim();
    const hasName =
      name.length >= 2 && !/^usuario$/i.test(name) && !/^cliente$/i.test(name);
    if (!hasName) {
      navigation.replace('Name');
      return;
    }

    // 2) Email si no está y NO ha sido diferido
    const emailValue = (user?.email ?? '').trim();
    const hasEmail = emailValue.length > 0;
    if (!hasEmail && !emailDeferred) {
      navigation.replace('EmailOptional');
      return;
    }

    // 3) Ruta feliz -> Home (desde allí se llega a Mercado/Bodega)
    navigation.replace('Dashboard');
  }, [booting, isLoadingMe, user, emailDeferred, navigation, signOut]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

/** ---------------- App Navigator ---------------- **/
export default function AppNavigator() {
  const { booting, isAuthenticated, user } = useAuth();

  // Estado B2B del usuario (si el backend ya lo incluye en /auth/me)
  const role = (user as any)?.role as 'ADMIN' | 'B2C' | 'B2B' | undefined;
  const businessVerificationStatus = (user as any)?.businessVerificationStatus as
    | 'NONE'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | undefined;

  const canSeeBodegaVirtual =
    B2B_ENABLED && role === 'B2B' && businessVerificationStatus === 'APPROVED';

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const headerRightCommon = (navigation: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => navigation.navigate('Dashboard')}
        style={{ paddingHorizontal: 6 }}
        accessibilityLabel="Ir al inicio"
      >
        <Ionicons name="home-outline" size={22} color="#111" />
      </Pressable>

      {user?.role === 'ADMIN' ? (
        <>
          {/* Admin: listas de precio B2C/B2B */}
          <Pressable
            onPress={() => navigation.navigate('AdminPriceListB2C')}
            style={{ paddingHorizontal: 6 }}
          >
            <Ionicons name="pricetag-outline" size={22} color="#111" />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('AdminPriceListB2B')}
            style={{ paddingHorizontal: 6 }}
          >
            <Ionicons name="pricetags-outline" size={22} color="#111" />
          </Pressable>
          {/* Admin: pedidos */}
          <Pressable
            onPress={() => navigation.navigate('AdminOrders')}
            style={{ paddingHorizontal: 6 }}
          >
            <Ionicons name="clipboard-outline" size={22} color="#111" />
          </Pressable>
          {/* Admin: solicitudes B2B (solo si el feature está activo) */}
          {B2B_ENABLED && (
            <Pressable
              onPress={() => navigation.navigate('AdminBusinessApplications')}
              style={{ paddingHorizontal: 6 }}
            >
              <Ionicons name="briefcase-outline" size={22} color="#111" />
            </Pressable>
          )}
        </>
      ) : null}

      <FavoritesButton />
      <OrdersButton />
      <HeaderCartButton onPress={() => navigation.navigate('Cart')} />
      <HeaderProfileButton onPress={() => navigation.navigate('Profile')} />
    </View>
  );

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <RootStack.Navigator
          initialRouteName="Home" // <- pasa por el gate siempre
          screenOptions={{ headerBackTitle: 'Atrás' }}
        >
          {/* Gate decide el onboarding pendiente */}
          <RootStack.Screen
            name="Home"
            component={PostAuthGate}
            options={{ headerShown: false }}
          />

          {/* Onboarding post-OTP */}
          <RootStack.Screen
            name="Name"
            component={NameScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EmailOptional"
            component={EmailOptionalScreen}
            options={{ title: 'Agrega tu correo (opcional)' }}
          />

          {/* HOME */}
          <RootStack.Screen
            name="Dashboard"
            component={HomeScreen}
            options={({ navigation }) => ({
              title: 'Inicio',
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* MARKET/CATÁLOGO */}
          <RootStack.Screen
            name="Market"
            component={MarketScreen}
            options={({ navigation }) => ({
              title: 'Mercado',
              headerRight: () => headerRightCommon(navigation),
            })}
          />
          <RootStack.Screen
            name="Catalog"
            component={MarketScreen}
            options={({ navigation }) => ({
              title: 'Mercado',
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* RESTAURANTES (flag) */}
          {RESTAURANTS_ENABLED && (
            <RootStack.Screen
              name="RestaurantsPlaceholder"
              component={RestaurantsPlaceholderScreen}
              options={({ navigation }) => ({
                title: 'Restaurantes',
                headerRight: () => headerRightCommon(navigation),
              })}
            />
          )}

          {/* BODEGA VIRTUAL (B2B) — la ruta existe, pero su acceso UI se controla con canSeeBodegaVirtual */}
          {B2B_ENABLED && (
            <RootStack.Screen
              name="Bodega"
              component={BodegaScreen}
              options={({ navigation }) => ({
                title: 'Bodega Virtual',
                headerRight: () => headerRightCommon(navigation),
              })}
            />
          )}

          {/* PRODUCTO / PERFIL / CARRITO */}
          <RootStack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={({ navigation }) => ({
              title: 'Detalle',
              headerRight: () => headerRightCommon(navigation),
            })}
          />
          <RootStack.Screen name="Cart" component={CartScreen} options={{ title: 'Carrito' }} />
          <RootStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />

          {/* DIRECCIONES (modal con stack anidado) */}
          <RootStack.Screen
            name="Addresses"
            component={AddressesNavigator}
            options={{ headerShown: false, presentation: 'modal' }}
          />

          {/* PEDIDOS / FAVORITOS / ADMIN */}
          <RootStack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'Mis pedidos' }} />
          <RootStack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Mis favoritos' }} />
          <RootStack.Screen
            name="AdminPriceListB2C"
            component={AdminPriceListB2CScreen}
            options={({ navigation }) => ({
              title: 'Lista precio cliente (B2C)',
              headerRight: () => headerRightCommon(navigation),
            })}
          />
          <RootStack.Screen
            name="AdminPriceListB2B"
            component={AdminPriceListB2BScreen}
            options={({ navigation }) => ({
              title: 'Lista precios negocios (B2B)',
              headerRight: () => headerRightCommon(navigation),
            })}
          />
          <RootStack.Screen
            name="AdminOrders"
            component={AdminOrdersScreen}
            options={({ navigation }) => ({
              title: 'Pedidos (Admin)',
              headerRight: () => headerRightCommon(navigation),
            })}
          />

          {/* Admin: Solicitudes B2B (solo si feature activo) */}
          {B2B_ENABLED && (
            <RootStack.Screen
              name="AdminBusinessApplications"
              component={AdminBusinessApplicationsScreen}
              options={({ navigation }) => ({
                title: 'Solicitudes B2B',
                headerRight: () => headerRightCommon(navigation),
              })}
            />
          )}

          <RootStack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ title: 'Estado del pedido' }}
          />

          {/* CHECKOUT */}
          <RootStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
          <RootStack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ title: 'Pedido creado' }} />
        </RootStack.Navigator>
      ) : (
        <RootStack.Navigator initialRouteName="AuthChooser" screenOptions={{ headerBackTitle: 'Atrás' }}>
          {/* Auth flow (celular primero) */}
          <RootStack.Screen name="AuthChooser" component={AuthChooserScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="PhoneEntry" component={PhoneEntryScreen} options={{ title: 'Ingresa tu número' }} />
          <RootStack.Screen name="OtpCode" component={OtpCodeScreen} options={{ title: 'Código de verificación' }} />
          {/* También permitimos Name/EmailOptional en el stack de no autenticado
              por si el flujo se rehidrata en medio del onboarding */}
          <RootStack.Screen name="Name" component={NameScreen} options={{ headerShown: false }} />
          <RootStack.Screen
            name="EmailOptional"
            component={EmailOptionalScreen}
            options={{ title: 'Agrega tu correo (opcional)' }}
          />
        </RootStack.Navigator>
      )}
    </NavigationContainer>
  );
}
