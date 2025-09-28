// src/components/HeaderAddress.tsx
import React from "react";
import { Pressable, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useDefaultAddress } from "../hooks/useDefaultAddress";

type Props = { compact?: boolean };

export default function HeaderAddress({ compact = true }: Props) {
  const navigation = useNavigation<any>();
  const { defaultAddress, isLoading } = useDefaultAddress();

  // Navega al stack anidado de Direcciones (Addresses -> AddressList)
  const goToAddresses = () =>
    navigation.navigate("Addresses", { screen: "AddressList" });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#16a34a" />
      </View>
    );
  }

  const title = defaultAddress?.label ?? "Agregar dirección";
  const line1 = defaultAddress?.line1 ?? "Toca para configurar";

  return (
    <Pressable
      onPress={goToAddresses}
      accessibilityRole="button"
      accessibilityLabel="Abrir mis direcciones"
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Feather name="map-pin" size={16} color="#16a34a" />
      <View style={{ marginLeft: 6, maxWidth: 180 }}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {!compact && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {line1}
          </Text>
        )}
      </View>
      <Feather name="chevron-down" size={16} color="#111827" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  title: { fontSize: 12, fontWeight: "600", color: "#111827" },
  subtitle: { fontSize: 11, color: "#6B7280" },
});
