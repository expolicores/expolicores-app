// src/screens/ProductDetailScreen.tsx
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";

type ProductDetail = {
  id: number;
  name: string;
  price: number;
  description: string;
  stock: number;
  imageUrl?: string | null;
  category?: string | null;
};

async function fetchProduct(id: number, signal?: AbortSignal): Promise<ProductDetail> {
  const res = await api.get(`/products/${id}`, { signal });
  return res.data;
}

export default function ProductDetailScreen() {
  const route = useRoute<any>(); // tipa con RootStackParamList si lo tienes
  const navigation = useNavigation<any>();
  const id = Number(route.params?.id);

  const { data, isLoading, isRefetching, isError, error, refetch } = useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) => fetchProduct(id, signal),
    retry(failureCount, err: any) {
      // No reintentar en 404
      if (err?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });

  // Título dinámico cuando hay data
  useEffect(() => {
    if (data?.name) navigation.setOptions({ title: "Detalle" }); // o data.name si prefieres
  }, [data, navigation]);

  // --- Estados de carga/errores ---
  if (isLoading) {
    return (
      <View style={{ padding: 16 }}>
        <View
          style={{
            width: "100%",
            height: 220,
            borderRadius: 16,
            backgroundColor: "#e5e7eb",
          }}
        />
        <View style={{ height: 12 }} />
        <View style={{ width: "60%", height: 22, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
        <View style={{ height: 8 }} />
        <View style={{ width: "40%", height: 18, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
        <View style={{ height: 16 }} />
        <View style={{ width: "80%", height: 16, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
      </View>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      status === 404
        ? "Este producto ya no está disponible."
        : "No pudimos cargar el producto.";
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: status === 404 ? "#6b7280" : "#c1121f", marginBottom: 12 }}>
          {msg}
        </Text>
        <ActivityIndicator />
      </View>
    );
  }

  // --- UI principal ---
  const p = data!;
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
        {p.imageUrl ? (
          <Image
            source={{ uri: p.imageUrl }}
            style={{ width: "100%", aspectRatio: 16 / 9 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#e5e7eb" }} />
        )}

        {/* Contenido */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 4 }}>{p.name}</Text>
          <Text style={{ fontSize: 18, color: "#111827", marginBottom: 12 }}>
            ${p.price.toLocaleString("es-CO")}
          </Text>

          {p.category ? (
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Categoría: {p.category}</Text>
          ) : null}

          <Text style={{ color: "#374151", lineHeight: 20 }}>
            {p.description || "Sin descripción."}
          </Text>

          <Text
            style={{
              marginTop: 12,
              color: p.stock > 0 ? "#059669" : "#dc2626",
              fontWeight: "600",
            }}
          >
            {p.stock > 0 ? `Stock: ${p.stock}` : "Sin stock"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
