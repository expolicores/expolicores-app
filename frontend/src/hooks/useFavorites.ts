import React from 'react';
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import type { Product } from '../types/product';
import {
  addFavorite,
  fetchFavorites,
  removeFavorite,
} from '../lib/api';

type ToggleArgs = {
  product: Product;
  shouldAdd: boolean;
};

export function useFavorites() {
  const { isAuthenticated, booting } = useAuth();
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery<Product[]>({
    queryKey: ['favorites'],
    queryFn: ({ signal }) => fetchFavorites({ signal }),
    enabled: isAuthenticated && !booting,
    staleTime: 60_000,
  });

  const favoriteIds = React.useMemo(() => {
    return new Set((favoritesQuery.data ?? []).map((p) => p.id));
  }, [favoritesQuery.data]);

  const mutation = useMutation({
    mutationFn: async ({ product, shouldAdd }: ToggleArgs) => {
      if (shouldAdd) {
        return addFavorite(product.id);
      }
      await removeFavorite(product.id);
      return null;
    },
    onMutate: async ({ product, shouldAdd }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previousFavorites = queryClient.getQueryData<Product[]>(['favorites']);

      queryClient.setQueryData<Product[]>(['favorites'], (current) => {
        const list = current ?? [];
        if (shouldAdd) {
          if (list.some((p) => p.id === product.id)) return list;
          return [{ ...product, isFavorite: true }, ...list];
        }
        return list.filter((p) => p.id !== product.id);
      });

      const productQueries = queryClient.getQueriesData({ queryKey: ['products'] });
      const previousProducts = productQueries.map(([key, value]) => [key, value] as const);
      productQueries.forEach(([key, value]) => {
        if (!value) return;
        const data = value as InfiniteData<{ items: Product[]; nextPage?: number | null }>;
        const updated: InfiniteData<{ items: Product[]; nextPage?: number | null }> = {
          pageParams: data.pageParams,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === product.id ? { ...item, isFavorite: shouldAdd } : item
            ),
          })),
        };
        queryClient.setQueryData(key, updated);
      });

      const previousProductDetail = queryClient.getQueryData(['product', product.id]);

      queryClient.setQueryData(['product', product.id], (old: any) => {
        if (!old) return old;
        return { ...old, isFavorite: shouldAdd };
      });

      return { previousFavorites, previousProducts, previousProductDetail, productId: product.id };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      queryClient.setQueryData(['favorites'], context.previousFavorites);
      context.previousProducts.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      if (context.previousProductDetail !== undefined && context.productId != null) {
        queryClient.setQueryData(['product', context.productId], context.previousProductDetail);
      }
    },
    onSettled: (_res, _err, { product }) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['product', product.id] });
    },
  });

  const toggleFavorite = React.useCallback(
    (product: Product) => {
      if (!isAuthenticated) return;
      const current = queryClient.getQueryData<Product[]>(['favorites']) ?? [];
      const isFav = current.some((p) => p.id === product.id) || favoriteIds.has(product.id) || product.isFavorite === true;
      mutation.mutate({ product, shouldAdd: !isFav });
    },
    [mutation, queryClient, favoriteIds, isAuthenticated]
  );

  return {
    favorites: favoritesQuery.data ?? [],
    favoriteIds,
    isLoading: favoritesQuery.isLoading,
    isFetching: favoritesQuery.isFetching,
    refetch: favoritesQuery.refetch,
    toggleFavorite,
    isMutating: mutation.isPending,
  };
}
