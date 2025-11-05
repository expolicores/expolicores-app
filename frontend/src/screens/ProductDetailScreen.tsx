// src/screens/ProductDetailScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useFavorites } from "../hooks/useFavorites";
import { formatCurrency } from "../lib/formatCurrency";
import { resolveProductImageUri } from "../lib/image";
import type { Product } from "../types/product";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

type ProductDetail = {
  id: number;
  name: string;
  price: number;
  b2bPrice: number;
  description: string;
  stock: number;
  imageUrl?: string | null;
  category?: string | null;
  isFavorite?: boolean;
};

type RouteOverrides = {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
} | undefined;

async function fetchProduct(id: number, signal?: AbortSignal): Promise<ProductDetail> {
  const res = await api.get(`/products/${id}`, { signal });
  return res.data;
}

export default function ProductDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  // Acepta `productId` (desde Feed) o `id` (otras rutas)
  const routeId = route.params?.productId ?? route.params?.id;
  const id = Number(routeId);
  const overrides: RouteOverrides = route.params?.overrides;

  const { data, isLoading, isRefetching, isError, error, refetch } = useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) => fetchProduct(id, signal),
    enabled: Number.isFinite(id),
    networkMode: "offlineFirst",
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry(failureCount, err: any) {
      if (err?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });

  const { items, add } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { favoriteIds, toggleFavorite, isMutating } = useFavorites();
  const [qty, setQty] = useState(1);

  const isB2B = user?.role === "BUSINESS" || user?.role === "B2B" || user?.role === "ADMIN";

  // Datos finales para UI (API → override por nombre/desc/imagen; precio: override solo para mostrar)
  const product = data as ProductDetail | undefined;

  const unitPriceFromAPI = useMemo(() => {
    if (!product) return undefined;
    return isB2B ? (typeof product.b2bPrice === "number" ? product.b2bPrice : product.price) : product.price;
  }, [product, isB2B]);

  const display = {
    name: overrides?.name ?? product?.name ?? "",
    description: overrides?.description ?? product?.description ?? "",
    // Sólo para UI: permite que una promo fuerce el precio mostrado sin tocar el precio que va al carrito
    price: typeof overrides?.price === "number" ? overrides.price : unitPriceFromAPI,
    imageUrl: resolveProductImageUri(overrides?.imageUrl ?? product?.imageUrl ?? null),
    category: product?.category ?? null,
    stock: product?.stock ?? 0,
    refPrice: product?.price, // referencia público
    id: product?.id ?? id,
  };

  // Header
  useEffect(() => {
    if (display.name) navigation.setOptions({ title: "Detalle" });
  }, [display.name, navigation]);

  // Loading skeleton
  if (isLoading && !product) {
    return (
      <View style={{ padding: 16 }}>
        <View style={{ width: "100%", height: 220, borderRadius: 16, backgroundColor: "#e5e7eb" }} />
        <View style={{ height: 12 }} />
        <View style={{ width: "60%", height: 22, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
        <View style={{ height: 8 }} />
        <View style={{ width: "40%", height: 18, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
        <View style={{ height: 16 }} />
        <View style={{ width: "80%", height: 16, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
      </View>
    );
  }

  // Error / 404 (si hay overrides al menos mostramos una vista mínima sin poder agregar)
  if (isError && !product) {
    const status = (error as any)?.response?.status;
    const hasFallback = !!overrides;
    if (!hasFallback) {
      const msg = status === 404 ? "Este producto ya no está disponible." : "No pudimos cargar el producto.";
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: status === 404 ? "#6b7280" : "#c1121f", marginBottom: 12 }}>{msg}</Text>
          <ActivityIndicator />
        </View>
      );
    }
  }

  // Si no hubo error crítico, seguimos con la UI principal
  const p = product;
  const formattedPrice = typeof display.price === "number" ? formatCurrency(display.price) : "—";
  const referencePrice = typeof display.refPrice === "number" ? formatCurrency(display.refPrice) : undefined;

  const isFavorite = (p && favoriteIds.has(p.id)) || p?.isFavorite === true;

  const productForToggle: Product = {
    ...(p as any),
    id: display.id,
    name: display.name,
    price: typeof display.price === "number" ? display.price : display.refPrice ?? 0,
    isFavorite: true,
    imageUrl: display.imageUrl,
  };

  const stockTotal = display.stock || 0;

  // Cantidad ya reservada en el carrito
  const inCartQty = items.find((i) => i.productId === display.id)?.qty ?? 0;

  // Disponible (UI)
  const remaining = Math.max(0, stockTotal - inCartQty);
  const remainingAfterSelection = Math.max(0, remaining - qty);

  const clampQty = (q: number) => {
    if (remaining <= 0) return 1;
    return Math.min(Math.max(1, q), remaining);
  };

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      navigation.navigate("Login", { message: "Inicia sesión para guardar favoritos" });
      return;
    }
    toggleFavorite(productForToggle);
  };

  const handleAddToCart = () => {
    if (!p) {
      Alert.alert("No disponible", "Aún no pudimos cargar el producto desde el servidor.");
      return;
    }
    if (remaining <= 0) {
      Alert.alert("Sin stock", "No hay más unidades disponibles para agregar.");
      return;
    }
    const finalQty = clampQty(qty);

    // Para el carrito usamos SIEMPRE el precio del backend si existe (evita inconsistencias),
    // y si por alguna razón no está, caemos al precio mostrado (override) como último recurso.
    const priceForCart =
      typeof unitPriceFromAPI === "number"
        ? unitPriceFromAPI
        : typeof display.price === "number"
        ? display.price
        : p.price;

    add(
      {
        productId: p.id,
        name: display.name || p.name,
        price: priceForCart,
        imageUrl: display.imageUrl,
        stock: stockTotal || 99,
        category: display.category ?? null,
      },
      finalQty,
    );

    setQty(1);

    Alert.alert(
      "Agregado al carrito",
      `${finalQty} x ${display.name || p.name}`,
      [
        { text: "Seguir comprando", style: "cancel" },
        { text: "Ir al carrito", onPress: () => navigation.navigate("Cart") },
      ],
      { cancelable: true },
    );
  };

  const canAdd = !!p && remaining > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        {/* Imagen */}
        <Image
          source={{ uri: display.imageUrl }}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />

        {/* Contenido */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", flex: 1, marginBottom: 4 }} numberOfLines={2}>
              {display.name || "Producto"}
            </Text>
            <Pressable
              onPress={handleToggleFavorite}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              hitSlop={8}
              disabled={isMutating}
              style={{ padding: 4, opacity: isMutating ? 0.6 : 1 }}
            >
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#ef4444" : "#111"} />
            </Pressable>
          </View>

          <Text style={{ fontSize: 18, color: "#111827", marginBottom: isB2B ? 4 : 12 }}>
            {formattedPrice}
          </Text>
          {isB2B && referencePrice ? (
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              Precio cliente: {referencePrice}
            </Text>
          ) : null}
          {display.category ? (
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Categoría: {display.category}</Text>
          ) : null}

          <Text style={{ color: "#374151", lineHeight: 20 }}>
            {display.description || "Sin descripción."}
          </Text>

          {/* Estado de stock con desglose */}
          {typeof stockTotal === "number" ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: remaining > 0 ? "#059669" : "#dc2626", fontWeight: "600" }}>
                {remaining > 0
                  ? `Stock disponible ahora: ${remaining} unidad${remaining === 1 ? "" : "es"}`
                  : `Sin stock disponible`}
              </Text>
              {inCartQty > 0 && (
                <Text style={{ color: "#6b7280", marginTop: 2 }}>
                  En tu carrito: {inCartQty} unidad{inCartQty === 1 ? "" : "es"}
                </Text>
              )}
              {remaining > 0 && qty > 0 && (
                <Text style={{ color: "#6b7280", marginTop: 2 }}>
                  Si agregas {qty}, quedarían {remainingAfterSelection} unidad
                  {remainingAfterSelection === 1 ? "" : "es"}.
                </Text>
              )}
            </View>
          ) : null}

          {/* Selector de cantidad */}
          {canAdd && (
            <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => setQty((q) => clampQty(q - 1))}
                style={{
                  backgroundColor: "#e5e7eb",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginRight: 10,
                }}
                accessibilityRole="button"
                accessibilityLabel="Disminuir cantidad"
              >
                <Text style={{ fontSize: 18 }}>-</Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 18, fontWeight: "600" }}>{qty}</Text>

              <TouchableOpacity
                onPress={() => setQty((q) => clampQty(q + 1))}
                style={{
                  backgroundColor: "#e5e7eb",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginLeft: 10,
                }}
                accessibilityRole="button"
                accessibilityLabel="Aumentar cantidad"
              >
                <Text style={{ fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón Agregar al carrito */}
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={!canAdd}
            style={{
              marginTop: 16,
              backgroundColor: canAdd ? "#059669" : "#9ca3af",
              paddingVertical: 14,
              borderRadius: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${display.name || "producto"} al carrito`}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "600" }}>
              {canAdd ? "Agregar al carrito" : "Sin stock"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
