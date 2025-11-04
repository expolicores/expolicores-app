import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useCart } from '../context/CartContext';
import { resolveEffectiveFromFeed } from '../lib/promotionsOverlay';
import formatCurrency from '../lib/formatCurrency';

type Props = {
  slotItem: { id?: string; productId?: string };
  overlay?: any | null;
  imageUrl: string;
  title?: string;
  displayPrice?: number; // opcional: feed.priceB2C o overlay.price
};

export default function FeedMiniCard({ slotItem, overlay, imageUrl, title, displayPrice }: Props) {
  const { items, addFromFeed, decrementFromFeed, removeFromFeed } = useCart();
  const { effectiveProductId } = resolveEffectiveFromFeed({ slotItem, overlay });
  const qty = items[effectiveProductId]?.qty ?? 0;

  const onPlus = () => addFromFeed({ slotItem, overlay });
  const onMinus = () => decrementFromFeed({ slotItem, overlay });
  const onTrash = () => removeFromFeed({ slotItem, overlay });

  return (
    <View style={{ width: 160, marginRight: 12 }}>
      <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 120, borderRadius: 12 }} />
      {!!title && <Text numberOfLines={1} style={{ marginTop: 6, fontWeight: '600' }}>{title}</Text>}
      {!!displayPrice && <Text style={{ color: '#111', marginVertical: 4 }}>{formatCurrency(displayPrice)}</Text>}

      {qty === 0 ? (
        <TouchableOpacity onPress={onPlus} style={{ backgroundColor: '#111', paddingVertical: 10, borderRadius: 8, alignItems:'center' }}>
          <Text style={{ color: '#fff' }}>Agregar</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 8 }}>
          <TouchableOpacity onPress={qty === 1 ? onTrash : onMinus} style={{ padding: 10 }}>
            <Text style={{ fontSize: 18 }}>{qty === 1 ? '🗑' : '−'}</Text>
          </TouchableOpacity>
          <Text style={{ minWidth: 28, textAlign: 'center' }}>{qty}</Text>
          <TouchableOpacity onPress={onPlus} style={{ padding: 10 }}>
            <Text style={{ fontSize: 18 }}>＋</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
