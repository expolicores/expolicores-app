// frontend/src/navigation/types.ts

export type AddressStackParamList = {
  Addresses: undefined;
  AddressForm: { id?: number } | undefined;
};

export type RootStackParamList = {
  // Auth
  AuthChooser: undefined;
  PhoneEntry: { intent?: 'login' | 'register' } | undefined;
  OtpCode: {
    phone?: string;
    email?: string;
    intent?: 'login' | 'register';
    devOtp?: string;
    cooldownSeconds?: number;
    expiresInSeconds?: number;
    phoneMasked?: string;
  };
  Name: { phone?: string; email?: string } | undefined;
  EmailOptional:
    | { phone?: string; email?: string; name?: string; fromOtp?: boolean; mode?: 'loginByEmail' }
    | undefined;

  // Home/market & catálogo
  Home: undefined;                // wrapper opcional (tabs o stack principal)
  Dashboard: undefined;           // vista inicial con accesos rápidos
  Market: undefined;              // landing principal
  Catalog: { category?: string } | undefined;
  RestaurantsPlaceholder: undefined; // si lo usas como sección futura
  Bodega: undefined;

  // Producto / carrito / checkout
  ProductDetail: { id: number };
  Cart: undefined;
  Checkout: undefined;
  OrderSuccess: { orderId: number };

  // Perfil y listas
  Profile: undefined;
  Favorites: undefined;
  MyOrders: undefined;
  OrderTracking: { orderId: number };

  // Admin
  AdminPriceListB2C: undefined;
  AdminPriceListB2B: undefined;
  AdminOrders: undefined;
  AdminPromotions: undefined;               // ⬅️ listado de promociones (admin)
  PromoDetail: { promoId: string } | { promo?: any }; // ⬅️ detalle/edición de una promo

  // Direcciones (si las manejas como pantallas del root)
  Addresses: undefined;
  AddressForm: { id?: number } | undefined;

  // Legal / privacidad
  Legal: undefined;
  PrivacyAccount: undefined; // ⬅️ nuevo screen "Privacidad y cuenta"
};
