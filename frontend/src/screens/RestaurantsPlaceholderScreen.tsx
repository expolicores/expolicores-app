import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';


export default function RestaurantsPlaceholderScreen() {
return (
<SafeAreaView style={styles.container}>
<View style={styles.center}>
<Text style={styles.title}>Restaurantes</Text>
<Text style={styles.subtitle}>Muy pronto podrás pedir comida por aquí. ¡Te avisaremos!</Text>
</View>
</SafeAreaView>
);
}


const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: '#FFFFFF' },
center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
title: { fontSize: 20, fontWeight: '800', color: '#111' },
subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
});