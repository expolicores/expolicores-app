import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  GestureResponderEvent,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Product } from "../types/product";
import { useCart } from "../context/CartContext";

type Props = {
  product: Product;
  onAdd?: () => void; // opcional: el padre puede sobreescribir el comportamiento
};

export default function ProductCard({ product, onAdd }: Props) {
  const navigation = useNavigation<any>();
  const { add } = useCart();

  const goToDetail = () => {
    navigation.navigate("ProductDetail", { id: product.id });
  };

  const handleAdd = (e: GestureResponderEvent) => {
    // Aún llamamos por si algún RN soporta stopPropagation, pero ya NO lo necesitamos
    e.stopPropagation?.();

    if (onAdd) {
      onAdd();
      return;
    }

    const fallbackStock = 99;
    const stock = (product as any).stock ?? fallbackStock;

    add(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl ?? undefined,
        stock,
        category: product.category ?? null,
      },
      1
    );

    Alert.alert(
      "Agregado",
      product.name,
      [
        { text: "Seguir comprando", style: "cancel" },
        { text: "Ir al carrito", onPress: () => navigation.navigate("Cart") },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}>
      {/* Bloque clicable solo para navegar */}
      <Pressable
        onPress={goToDetail}
        style={{ flexDirection: "row", gap: 12, flex: 1 }}
        android_ripple={{ color: "#e5e7eb" }}
      >
        <Image
          source={{ uri: product.imageUrl ?? "https://picsum.photos/80" }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 8,
            backgroundColor: "#f3f4f6",
          }}
        />

        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600" }} numberOfLines={2}>
            {product.name}
          </Text>
          <Text>${product.price.toLocaleString("es-CO")}</Text>
        </View>
      </Pressable>

      {/* Botón independiente: NO navega */}
      <TouchableOpacity
        onPress={handleAdd}
        style={{
          alignSelf: "center",
          backgroundColor: "#111",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
        }}
        accessibilityRole="button"
        accessibilityLabel={`Agregar ${product.name}`}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Agregar</Text>
      </TouchableOpacity>
    </View>
  );
}
