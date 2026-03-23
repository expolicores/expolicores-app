// frontend/src/navigation/AppNavigator.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
  LinkingOptions,
} from '@react-navigation/native';
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
import LockerScreen from '../screens/LockerScreen'; // ⬅️ NUEVO

/** ========== Screens (market / restaurantes placeholder / bodega) ========== */
import MarketScreen from '../screens/MarketScreen';
import RestaurantsPlaceholderScreen from '../screens/RestaurantsPlaceholderScreen';
import BodegaScreen from '../screens/BodegaScreen';
import HomeScreen from '../screens/HomeScreen'; // ← Home “viejo” (fallback)
import FeedScreen from '../screens/FeedScreen'; // ← NUEVO feed como Home
import BottomQuickActionsBar from '../components/BottomQuickActionsBar';

/** ========== Admin — Solicitudes B2B (nuevo) ========== */
import AdminBusinessApplicationsScreen from '../screens/AdminBusinessApplicationsScreen';

/** ========== NUEVO: Detalle de Promo + Panel Admin de Promos ========== */
import PromoDetailScreen from '../screens/PromoDetailScreen';
import AdminPromotionsScreen from '../screens/AdminPromotionsScreen';

/** ========== Catálogo ========== */
import CatalogScreen from '../screens/CatalogScreen';

/** ========== Legal / Privacidad ========== */
import LegalScreen from '../screens/LegalScreen';
import PrivacyAccountScreen from '../screens/PrivacyAccountScreen';

/** ================= Buttons en header ================= */
import HeaderAddress from '../components/HeaderAddress';

/** ---------------- Feature flags ---------------- **/
const RESTAURANTS_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_RESTAURANTS || 'false') === 'true';
const B2B_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_B2B || 'false') === 'true';
const FEED_JSON_ENABLED =
  (process.env.EXPO_PUBLIC_FEATURE_FEED_JSON || 'true') === 'true'; // ← por defecto ON

const QUICK_ACTION_ROUTES = new Set<string>([
  'Dashboard',
  'Favorites',
  'Locker', // ⬅️ NUEVO: casillero aparece en quick actions
  'MyOrders',
  'Profile',
  'AdminPriceListB2C',
  'AdminPriceListB2B',
  'AdminOrders',
  'AdminBusinessApplications',
  'AdminPromotions', // ← mostramos barra rápida también aquí (opcional)
]);

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

    // 3) Ruta feliz -> Home (Dashboard)
    navigation.replace('Dashboard');
  }, [booting, isLoadingMe, user, emailDeferred, navigation, signOut]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

/** ---------------- Linking (deeplinks internos del feed) ---------------- **/
const linking: LinkingOptions<any> = {
  prefixes: ['app://', 'expolicores://'],
  config: {
    screens: {
      // Colecciones “especiales” (ej: promos-b2c) que ya usabas
      Catalog: {
        path: 'collection/:slug',
        parse: { slug: (v: string) => String(v) },
      },
      // NUEVO: categorías del catálogo → usa la MISMA pantalla Catalog pero con otro path
      CatalogByCategory: {
        path: 'collection/cat/:slug',
        parse: { slug: (v: string) => String(v) },
      },
      ProductDetail: {
        path: 'product/:productId',
        parse: { productId: (v: string) => String(v) },
      },
      // PromoDetail: 'promo/:promoId'
    },
  },
};

/** ---------------- App Navigator ---------------- **/
export default function AppNavigator() {
  const navigationRef = useNavigationContainerRef();
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(
    undefined,
  );
  const { booting, isAuthenticated, user } = useAuth();

  // Estado/B2B del usuario
  const role = (user as any)?.role as 'ADMIN' | 'B2C' | 'B2B' | undefined;
  const isAdmin = role === 'ADMIN';
  const canSeeBodegaVirtual = B2B_ENABLED && (role === 'B2B' || isAdmin);

  const handleReady = useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    setCurrentRouteName(route?.name);
  }, [navigationRef]);

  const handleStateChange = useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    setCurrentRouteName(route?.name);
  }, [navigationRef]);

  const shouldShowQuickActions = useMemo(
    () =>
      isAuthenticated && currentRouteName
        ? QUICK_ACTION_ROUTES.has(currentRouteName)
        : false,
    [isAuthenticated, currentRouteName],
  );

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Helper: botón de carrito + (opcional) un botón extra a la derecha
  const headerRightCommon = (navigation: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <HeaderCartButton onPress={() => navigation.navigate('Cart')} />
    </View>
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleReady}
      onStateChange={handleStateChange}
      linking={linking}
    >
      <View style={{ flex: 1 }}>
        {isAuthenticated ? (
          <RootStack.Navigator
            initialRouteName="Home" // pasa por el gate siempre
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

            {/* HOME (Dashboard) → FeedScreen si el flag está ON, si no HomeScreen */}
            <RootStack.Screen
              name="Dashboard"
              component={FEED_JSON_ENABLED ? FeedScreen : HomeScreen}
              options={({ navigation }) => ({
                headerTitle: '',
                headerLeft: () => <HeaderAddress compact />,
                headerRight: () => headerRightCommon(navigation),
                headerShown: true,
              })}
            />

            {/* MARKET */}
            <RootStack.Screen
              name="Market"
              component={MarketScreen}
              options={({ navigation }) => ({
                title: 'Mercado',
                headerRight: () => headerRightCommon(navigation),
              })}
            />

            {/* CATALOGO (colecciones “especiales” por slug) */}
            <RootStack.Screen
              name="Catalog"
              component={CatalogScreen}
              options={({ navigation }) => ({
                title: 'Catálogo',
                headerRight: () => headerRightCommon(navigation),
              })}
            />

            {/* CATALOGO por CATEGORÍA (misma pantalla, path distinto) */}
            {/* @ts-expect-error: añade en RootStackParamList si usas tipos estrictos */}
            <RootStack.Screen
              name="CatalogByCategory"
              component={CatalogScreen}
              options={({ navigation }) => ({
                title: 'Catálogo',
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

            {/* BODEGA VIRTUAL (B2B) — acceso UI controlado por canSeeBodegaVirtual */}
            {B2B_ENABLED && canSeeBodegaVirtual && (
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

            {/* NUEVO: Detalle de promoción */}
            {/* @ts-expect-error agregar a RootStackParamList si usas tipos estrictos */}
            <RootStack.Screen
              name="PromoDetail"
              component={PromoDetailScreen}
              options={({ navigation }) => ({
                title: 'Promoción',
                headerRight: () => headerRightCommon(navigation),
              })}
            />

            {/* NUEVO: Panel Admin de Promociones */}
            {/* @ts-expect-error agregar a RootStackParamList si usas tipos estrictos */}
            <RootStack.Screen
              name="AdminPromotions"
              component={AdminPromotionsScreen}
              options={({ navigation }) => ({
                title: 'Promociones (Admin)',
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

            {/* Miscelánea */}
            <RootStack.Screen
              name="Cart"
              component={CartScreen}
              options={{ title: 'Carrito' }}
            />
            <RootStack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Perfil' }}
            />
            <RootStack.Screen
              name="Addresses"
              component={AddressesNavigator}
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <RootStack.Screen
              name="MyOrders"
              component={MyOrdersScreen}
              options={{ title: 'Mis pedidos' }}
            />
            <RootStack.Screen
              name="Favorites"
              component={FavoritesScreen}
              options={{ title: 'Mis favoritos' }}
            />
            <RootStack.Screen
              name="Locker"
              component={LockerScreen}
              options={{ title: 'Mi casillero' }} // ⬅️ NUEVO
            />
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
            <RootStack.Screen
              name="OrderTracking"
              component={OrderTrackingScreen}
              options={{ title: 'Estado del pedido' }}
            />
            <RootStack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{ title: 'Checkout' }}
            />
            <RootStack.Screen
              name="OrderSuccess"
              component={OrderSuccessScreen}
              options={{ title: 'Pedido creado' }}
            />

            {/* Legal / privacidad */}
            <RootStack.Screen
              name="Legal"
              component={LegalScreen}
              options={{ title: 'Términos y política de datos' }}
            />
            <RootStack.Screen
              name="PrivacyAccount"
              component={PrivacyAccountScreen}
              options={{ title: 'Privacidad y cuenta' }}
            />
          </RootStack.Navigator>
        ) : (
          <RootStack.Navigator
            initialRouteName="AuthChooser"
            screenOptions={{ headerBackTitle: 'Atrás' }}
          >
            {/* Auth flow (celular primero) */}
            <RootStack.Screen
              name="AuthChooser"
              component={AuthChooserScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="PhoneEntry"
              component={PhoneEntryScreen}
              options={{ title: 'Ingresa tu número' }}
            />
            <RootStack.Screen
              name="OtpCode"
              component={OtpCodeScreen}
              options={{ title: 'Código de verificación' }}
            />
            {/* También permitimos Name/EmailOptional en el stack de no autenticado por si el flujo se rehidrata */}
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
            {/* Legal también accesible antes de autenticarse */}
            <RootStack.Screen
              name="Legal"
              component={LegalScreen}
              options={{ title: 'Términos y política de datos' }}
            />
          </RootStack.Navigator>
        )}
        {shouldShowQuickActions ? <BottomQuickActionsBar /> : null}
      </View>
    </NavigationContainer>
  );
}
