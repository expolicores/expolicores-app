import React, { useMemo } from 'react';
import { ScrollView, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getCategories } from '../lib/api';

type Props = {
  /** Categoría seleccionada; si es undefined, se considera "Todos" */
  selected?: string;
  /** Cambia la categoría; pasa undefined para "Todos" */
  onSelect: (value?: string) => void;
  /** Al tocar "Todos", además de onSelect(undefined) se llama esto (útil para limpiar búsqueda) */
  onResetAll?: () => void;
  /** Si viene informado, no consulta al API */
  categories?: string[];
  contentContainerStyle?: ViewStyle;
};

export default function CategoryChips({
  selected,
  onSelect,
  onResetAll,
  categories,
  contentContainerStyle,
}: Props) {
  // Si no recibimos categories por props, las traemos del API
  const { data: fetched } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
    enabled: !categories, // no consultes si llegan por props
  });

  // Lista final: 'Todos' + únicas, sin null/undefined/'' (orden sensible a acentos base-insensitive)
  const chips = useMemo(() => {
    const base = (categories ?? fetched ?? []).filter(
      (c): c is string => typeof c === 'string' && c.trim().length > 0,
    );
    const unique = Array.from(new Set(base)).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    );
    return ['Todos', ...unique];
  }, [categories, fetched]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, contentContainerStyle]}
    >
      {chips.map((cat) => {
        const isTodos = cat === 'Todos';
        const active =
          (selected == null && isTodos) || // cuando selected es undefined => "Todos" activo
          selected === cat ||              // compat si el padre envía 'Todos' como string
          false;

        return (
          <Pressable
            key={cat}
            onPress={() => {
              if (isTodos) {
                onSelect(undefined);
                onResetAll?.();
              } else {
                onSelect(cat);
              }
            }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{cat}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  text: { color: '#111827' },
  textActive: { color: '#fff', fontWeight: '600' },
});
