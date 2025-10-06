import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../lib/theme';


export function EmptyCart({ onBrowse }: { onBrowse: () => void }) {
return (
<View style={styles.container}>
<Text style={styles.title}>Tu carrito está vacío</Text>
<Text style={styles.subtitle}>Explora el catálogo y añade tus productos favoritos.</Text>
<TouchableOpacity onPress={onBrowse} style={styles.btn}>
<Text style={styles.btnText}>Ir al catálogo</Text>
</TouchableOpacity>
</View>
);
}


const styles = StyleSheet.create({
container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
title: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
subtitle: { fontSize: 14, color: colors.text.secondary, textAlign: 'center' },
btn: { backgroundColor: colors.brand.green, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
btnText: { color: colors.text.inverse, fontWeight: '700' },
});