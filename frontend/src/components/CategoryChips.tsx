import React from 'react';
import { ScrollView, TouchableOpacity, Text, View } from 'react-native';


export default function CategoryChips({ categories, active, onChange }:{ categories: string[]; active: string | null; onChange: (c: string | null) => void }) {
const all = ['Todos', ...categories];
return (
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
{all.map((c) => {
const isActive = (c === 'Todos' && !active) || c === active;
return (
<TouchableOpacity key={c} onPress={() => onChange(c === 'Todos' ? null : c)} style={{
paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginRight: 8,
backgroundColor: isActive ? '#111' : '#eee',
}}>
<Text style={{ color: isActive ? '#fff' : '#111' }}>{c}</Text>
</TouchableOpacity>
);
})}
</ScrollView>
);
}