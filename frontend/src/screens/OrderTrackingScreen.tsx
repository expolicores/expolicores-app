// src/screens/OrderTrackingScreen.tsx
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { Order } from "../types/order";
import { isFinal, statusLabel } from "../lib/orderStatus";

async function fetchOrder(orderId: number): Promise<Order> {
  const { data } = await api.get(`/orders/${orderId}`);
  return data as Order;
}

export default function OrderTrackingScreen() {
  const { params } = useRoute<any>();
  const orderId = Number(params?.orderId);
  const initial: Order | undefined = params?.initial;

  const qc = useQueryClient();

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: Number.isFinite(orderId),
    // Muestra algo de inmediato si venimos desde la lista
    initialData: initial,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    // Polling solo si el estado no es final
    refetchInterval: (q) => {
      const s = (q.state.data as Order | undefined)?.status;
      return s && !isFinal(s) ? 12000 : false;
    },
    staleTime: 0,
  });

  // 🔔 Si el pedido llega a estado final, actualiza lista y badge del header
  React.useEffect(() => {
    const s = data?.status;
    if (s && isFinal(s)) {
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders", "active-count"] });
    }
  }, [data?.status, qc]);

  if (!Number.isFinite(orderId)) {
    return (
      <Center>
        <Text>ID de pedido inválido</Text>
      </Center>
    );
  }

  if (isLoading && !data) {
    return (
      <Center>
        <ActivityIndicator />
      </Center>
    );
  }

  if (error && !data) {
    return (
      <Center>
        <Text style={{ color: "#ef4444", marginBottom: 8 }}>
          No se pudo cargar el pedido.
        </Text>
        <Text style={{ color: "#666", fontSize: 12 }}>
          {String((error as any)?.message ?? "Error")}
        </Text>
      </Center>
    );
  }

  const order = data as Order;
  const steps = ["RECIBIDO", "EN_CAMINO", "ENTREGADO"] as const;
  const currentIndex =
    order.status === "CANCELADO"
      ? -1
      : steps.findIndex((s) => s === order.status);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} />
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "700" }}>
          Pedido #{order.id}
        </Text>
        <StatusBadge status={order.status} />
      </View>

      <Text style={{ marginTop: 6, color: "#666" }}>
        Última actualización:{" "}
        {new Date(order.updatedAt ?? order.createdAt).toLocaleString()}
      </Text>

      <View style={{ marginTop: 20 }}>
        {order.status === "CANCELADO" ? (
          <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 16 }}>
            Este pedido fue cancelado.
          </Text>
        ) : (
          steps.map((s, idx) => {
            const done = idx <= currentIndex;
            const color = done ? "#16a34a" : "#d1d5db";
            return (
              <View
                key={s}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: color,
                    marginRight: 12,
                  }}
                />
                <Text style={{ fontSize: 16, color: done ? "#111" : "#777" }}>
                  {statusLabel[s]}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View
        style={{
          marginTop: 24,
          padding: 12,
          backgroundColor: "#fafafa",
          borderRadius: 12,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Resumen</Text>
        {order.items?.map((i) => (
          <Text key={i.id} style={{ color: "#444" }}>
            {i.quantity}× {i.product?.name ?? "Producto"}{" "}
            {i.product ? `— $${i.product.price}` : ""}
          </Text>
        ))}
        <Text style={{ marginTop: 8, fontWeight: "700" }}>Total: ${order.total}</Text>
      </View>
    </ScrollView>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      {children}
    </View>
  );
}
