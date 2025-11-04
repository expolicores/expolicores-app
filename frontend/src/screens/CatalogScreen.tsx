// src/screens/CatalogScreen.tsx

import React, { useMemo } from 'react';
import { RouteProp } from '@react-navigation/native';
import MarketScreen from './MarketScreen';

// Tipado laxo para no forzar cambios en RootStackParamList ahora
type AnyParams = Record<string, any>;
type CatalogRoute = RouteProp<Record<string, AnyParams>, string>;

type Props = {
  route: CatalogRoute;
  navigation: any;
};

/**
 * Traduce slugs conocidos del feed a filtros del catálogo.
 * Puedes ampliar este mapa sin tocar MarketScreen.
 */
function mapSlugToFilters(slug?: string) {
  if (!slug) return {};
  const s = String(slug).toLowerCase();

  // Mapeo de ejemplos iniciales (ajusta a tu taxonomía real)
  const map: Record<string, AnyParams> = {
    // Desde el feed:
    'low-stock':     { sort: 'stock_asc', stockLte: 3 },     // Cercano a agotarse
    'new':           { sort: 'created_desc' },               // Nuevo en la bodega
    'under-20k':     { priceLte: 20000, sort: 'price_asc' }, // Menos de $20.000
    'villa':         { citySlug: 'villa-de-leyva' },         // Solo para Villa
    'top':           { sort: 'top_14d' },                    // Lo más vendido

    // Categorías ejemplo (puedes alinear con tu schema):
    'aguardiente':   { categorySlug: 'aguardiente' },
    'ron':           { categorySlug: 'ron' },
    'vinos':         { categorySlug: 'vinos' },
    'cervezas':      { categorySlug: 'cervezas' },
  };

  return map[s] ?? {};
}

/**
 * CatalogScreen: envoltorio de MarketScreen
 * - Lee params de deeplink: slug / categorySlug / sort / priceLte...
 * - Fusiona con filtros derivados del slug (si aplica)
 * - Reenvía a MarketScreen inyectando route.params combinados
 */
export default function CatalogScreen(props: Props) {
  const { route, navigation } = props;
  const incoming = (route?.params ?? {}) as AnyParams;

  // Permite venir por:
  // - app://collection/:slug            -> route.params.slug
  // - app://collection/cat/:slug        -> route.params.slug (categoria)
  // Además acepta categorySlug/priceLte/sort directos en params
  const derived = useMemo(() => {
    const fromSlug = mapSlugToFilters(incoming.slug);
    // prioridad: params explícitos > derivados del slug
    return { ...fromSlug, ...incoming };
  }, [incoming]);

  // Inyecta los params combinados hacia MarketScreen
  const mergedRoute = useMemo(() => {
    return {
      ...route,
      params: {
        ...derived,
      },
    } as CatalogRoute;
  }, [route, derived]);

  // Opcional: ajustar el título según el slug (sin romper headers existentes)
  React.useLayoutEffect(() => {
    const titleFromSlug: Record<string, string> = {
      'low-stock': 'Cercano a agotarse',
      'new': 'Nuevo en la bodega',
      'under-20k': 'Menos de $20.000',
      'villa': 'Solo para Villa',
      'top': 'Lo más vendido',
    };
    const maybeTitle = titleFromSlug[String(incoming.slug || '')?.toLowerCase()];
    if (maybeTitle) {
      navigation.setOptions({ title: maybeTitle });
    }
  }, [navigation, incoming.slug]);

  // Renderiza MarketScreen con los params combinados
  return <MarketScreen {...props} route={mergedRoute} />;
}
