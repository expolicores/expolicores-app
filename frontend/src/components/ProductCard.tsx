import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  GestureResponderEvent,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
// Opcional: tipado fuerte si expusiste RootStackParamList en el navigator
// import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
// import type { RootStackParamList } from "../navigation/AppNavigator";
import { Product } from "../types/product";

type Props = {
  product: Product;
  onAdd?: () => void;
};

export default function ProductCard({ product, onAdd }: Props) {
  const navigation = useNavigation<any>(); // o: useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const goToDetail = () => {
    navigation.navigate("ProductDetail", { id: product.id });
  };

  const handleAdd = (e: GestureResponderEvent) => {
    // Evita que el tap del botón burbujee y dispare la navegación del card
    e.stopPropagation?.();
    onAdd?.();
  };

  return (
    <Pressable
      onPress={goToDetail}
      style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}
      android_ripple={{ color: "#e5e7eb" }}
    >
      <Image
        source={{ uri: product.imageUrl ?? "https://picsum.photos/80" }}
        style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: "#f3f4f6" }}
      />

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600" }} numberOfLines={2}>
          {product.name}
        </Text>

        <Text>${product.price.toLocaleString("es-CO")}</Text>

        <TouchableOpacity
          onPress={handleAdd}
          style={{
            marginTop: 6,
            backgroundColor: "#111",
            padding: 8,
            borderRadius: 8,
            alignSelf: "flex-start",
          }}
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${product.name}`}
        >
          <Text style={{ color: "white", textAlign: "center" }}>Agregar</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}
