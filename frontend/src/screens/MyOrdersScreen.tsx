// src/screens/MyOrdersScreen.tsx
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import api from "../lib/api";
import { formatCurrency } from "../lib/formatCurrency";
import StatusBadge from "../components/StatusBadge";
import { OrderListItem } from "../types/order";

async function fetchMyOrders(): Promise<OrderListItem[]> {
  const { data } = await api.get("/orders/my");
  return data as OrderListItem[];
}

const isActive = (o: OrderListItem) =>
  o.status === "RECIBIDO" || o.status === "EN_CAMINO";
const hasActive = (orders?: OrderListItem[]) => !!orders?.some(isActive);

export default function MyOrdersScreen() {
  const navigation = useNavigation<any>();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["my-orders", "list"],
    queryFn: fetchMyOrders,
    // 🔁 Auto-refresh solo cuando existan pedidos activos
    refetchInterval: (q) =>
      hasActive(q.state.data as OrderListItem[]) ? 8000 : false,
    refetchIntervalInBackground: false,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    staleTime: 0, // evita que se “congele” el estado mostrado
  });

  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6 }}>
          Error al cargar
        </Text>
        <Text style={{ color: "#6b7280", textAlign: "center" }}>
          No pudimos obtener tus pedidos. Desliza hacia abajo para reintentar.
        </Text>
      </View>
    );
  }

  const orders = (data ?? []).slice().sort((a, b) => {
    // opcional: asegurar orden descendente por fecha
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (orders.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 16 }}>Sin pedidos</Text>
        <Text style={{ color: "#6b7280", marginTop: 6, textAlign: "center" }}>
          Cuando hagas tu primera compra, verás su estado aquí.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      data={orders}
      keyExtractor={(o) => String(o.id)}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={0.85}
          // Pasa el pedido como "initial" para que OrderTracking muestre de inmediato
          onPress={() =>
            navigation.navigate("OrderTracking", {
              orderId: item.id,
              initial: item,
            })
          }
          style={{
            backgroundColor: "#fff",
            padding: 14,
            borderRadius: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#eee",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Pedido #{item.id}
            </Text>
            <StatusBadge status={item.status} />
          </View>

          <Text style={{ color: "#6b7280", marginTop: 4 }}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>

          <Text style={{ marginTop: 6 }} numberOfLines={1}>
            {(item.items ?? [])
              .map((i) => `${i.quantity}× ${i.product?.name ?? "Producto"}`)
              .join(" · ")}
          </Text>

          <Text style={{ marginTop: 8, fontWeight: "700" }}>
            {formatCurrency(item.total)}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}
