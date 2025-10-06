import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../lib/theme';
import { formatCurrency } from '../lib/formatCurrency';


export function CartSummaryBar({ count, subtotal, onContinue }: { count: number; subtotal: number; onContinue: () => void }) {
const disabled = count <= 0;
return (
<View style={styles.container}>
<View style={styles.left}>
<Text style={styles.meta}>Artículos ({count})</Text>
<Text style={styles.meta}>Subtotal {formatCurrency(subtotal)}</Text>
</View>
<TouchableOpacity
onPress={onContinue}
disabled={disabled}
style={[styles.cta, disabled && styles.ctaDisabled]}
accessibilityLabel="Continuar a checkout"
>
<Text style={styles.ctaText}>Continuar</Text>
</TouchableOpacity>
</View>
);
}


const styles = StyleSheet.create({
container: {
position: 'absolute',
left: 0,
right: 0,
bottom: 0,
backgroundColor: colors.ui.card,
borderTopWidth: 1,
borderTopColor: colors.ui.border,
paddingHorizontal: 16,
paddingTop: 10,
paddingBottom: 16,
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
},
left: { gap: 4 },
meta: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
cta: {
backgroundColor: colors.brand.green,
paddingHorizontal: 20,
paddingVertical: 12,
borderRadius: 12,
},
ctaDisabled: { opacity: 0.5 },
ctaText: { color: colors.text.inverse, fontSize: 16, fontWeight: '700' },
});