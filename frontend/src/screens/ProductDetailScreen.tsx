// src/screens/ProductDetailScreen.tsx
import React, { useEffect, useState } from "react";
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

async function fetchProduct(id: number, signal?: AbortSignal): Promise<ProductDetail> {
  const res = await api.get(`/products/${id}`, { signal });
  return res.data;
}

export default function ProductDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id = Number(route.params?.id);

  const { data, isLoading, isRefetching, isError, error, refetch } = useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) => fetchProduct(id, signal),
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

  useEffect(() => {
    if (data?.name) navigation.setOptions({ title: "Detalle" });
  }, [data, navigation]);

  // Loading skeleton
  if (isLoading) {
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

  // Error / 404
  if (isError) {
    const status = (error as any)?.response?.status;
    const msg = status === 404 ? "Este producto ya no esta disponible." : "No pudimos cargar el producto.";
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: status === 404 ? "#6b7280" : "#c1121f", marginBottom: 12 }}>{msg}</Text>
        <ActivityIndicator />
      </View>
    );
  }

  // UI principal
  const p = data!;
  const isB2B = user?.role === "BUSINESS" || user?.role === "ADMIN";
  const unitPrice = isB2B ? (typeof p.b2bPrice === "number" ? p.b2bPrice : p.price) : p.price;
  const formattedPrice = formatCurrency(unitPrice);
  const referencePrice = formatCurrency(p.price);
  const isFavorite = favoriteIds.has(p.id) || p.isFavorite === true;

  // ← ya NO usamos useMemo (evita romper el orden de hooks)
  const productForToggle: Product = {
    ...p,
    price: unitPrice,
    isFavorite: true,
  };

  const stockTotal = p.stock ?? 0;

  // Cantidad ya reservada en el carrito
  const inCartQty = items.find((i) => i.productId === p.id)?.qty ?? 0;

  // Disponible (UI)
  const remaining = Math.max(0, stockTotal - inCartQty);
  const remainingAfterSelection = Math.max(0, remaining - qty);
  const productImageUri = resolveProductImageUri(p.imageUrl);

  const clampQty = (q: number) => {
    if (remaining <= 0) return 1;
    return Math.min(Math.max(1, q), remaining);
    // Nota: adicionalmente hacemos clamp en handleAddToCart por si cambia el stock
  };

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      navigation.navigate("Login", { message: "Inicia sesion para guardar favoritos" });
      return;
    }
    toggleFavorite(productForToggle);
  };

  const handleAddToCart = () => {
    if (remaining <= 0) {
      Alert.alert("Sin stock", "No hay mas unidades disponibles para agregar.");
      return;
    }
    const finalQty = clampQty(qty);
    add(
      {
        productId: p.id,
        name: p.name,
        price: unitPrice,
        imageUrl: productImageUri,
        stock: stockTotal || 99,
        category: p.category ?? null,
      },
      finalQty,
    );

    setQty(1);

    Alert.alert(
      "Agregado al carrito",
      `${finalQty} x ${p.name}`,
      [
        { text: "Seguir comprando", style: "cancel" },
        { text: "Ir al carrito", onPress: () => navigation.navigate("Cart") },
      ],
      { cancelable: true },
    );
  };

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
          source={{ uri: productImageUri }}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />

        {/* Contenido */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", flex: 1, marginBottom: 4 }} numberOfLines={2}>
              {p.name}
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

          <Text style={{ fontSize: 18, color: "#111827", marginBottom: isB2B ? 4 : 12 }}>{formattedPrice}</Text>
          {isB2B ? (
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Precio cliente: {referencePrice}</Text>
          ) : null}
          {p.category ? <Text style={{ color: "#6b7280", marginBottom: 6 }}>Categoria: {p.category}</Text> : null}

          <Text style={{ color: "#374151", lineHeight: 20 }}>{p.description || "Sin descripcion."}</Text>

          {/* Estado de stock con desglose */}
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
                Si agregas {qty}, quedarian {remainingAfterSelection} unidad{remainingAfterSelection === 1 ? "" : "es"}.
              </Text>
            )}
          </View>

          {/* Selector de cantidad */}
          {remaining > 0 && (
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
            disabled={remaining <= 0}
            style={{
              marginTop: 16,
              backgroundColor: remaining > 0 ? "#059669" : "#9ca3af",
              paddingVertical: 14,
              borderRadius: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${p.name} al carrito`}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "600" }}>
              {remaining > 0 ? "Agregar al carrito" : "Sin stock"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
