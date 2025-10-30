// src/screens/MyOrdersScreen.tsx
import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { getBottomQuickActionsPadding } from "../components/BottomQuickActionsBar";
import type { OrderListItem } from "../types/order";

async function fetchMyOrders(): Promise<OrderListItem[]> {
  const { data } = await api.get("/orders/my");
  return data as OrderListItem[];
}

const isActive = (order: OrderListItem) =>
  order.status === "RECIBIDO" || order.status === "EN_CAMINO";
const hasActive = (orders?: OrderListItem[]) => !!orders?.some(isActive);

export default function MyOrdersScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["my-orders", "list"],
    queryFn: fetchMyOrders,
    refetchInterval: (query) =>
      hasActive((query as any)?.state?.data as OrderListItem[]) ? 8_000 : false,
    refetchIntervalInBackground: false,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  const orders = (data ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading && !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", paddingBottom: bottomPadding }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", paddingBottom: bottomPadding }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6 }}>Error al cargar</Text>
          <Text style={{ color: "#6b7280", textAlign: "center" }}>
            No pudimos obtener tus pedidos. Desliza hacia abajo para reintentar.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", paddingBottom: bottomPadding }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>Sin pedidos</Text>
          <Text style={{ color: "#6b7280", marginTop: 6, textAlign: "center" }}>
            Cuando hagas tu primera compra, verás su estado aquí.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", paddingBottom: bottomPadding }}>
      <FlatList
        data={orders}
        keyExtractor={(order) => String(order.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => {
          const summary = (item.items ?? [])
            .map((entry) => `${entry.quantity}x ${entry.product?.name ?? "Producto"}`)
            .join(" — ");

          return (
            <TouchableOpacity
              activeOpacity={0.85}
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
                <Text style={{ fontWeight: "700", fontSize: 16 }}>Pedido #{item.id}</Text>
                <StatusBadge status={item.status} />
              </View>

              <Text style={{ color: "#6b7280", marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>

              {summary ? <Text style={{ marginTop: 6 }} numberOfLines={1}>{summary}</Text> : null}

              <Text style={{ marginTop: 8, fontWeight: "700" }}>
                {formatCurrency(item.total)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
