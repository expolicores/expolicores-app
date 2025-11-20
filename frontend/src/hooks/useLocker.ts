// frontend/src/hooks/useLocker.ts
import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Product } from '../types/product';

async function fetchLocker(): Promise<Product[]> {
  const res = await api.get<Product[]>('/locker');
  return res.data;
}

type ToggleArgs = {
  productId: number;
  inLocker: boolean;
};

async function toggleLockerRequest({ productId, inLocker }: ToggleArgs) {
  if (inLocker) {
    await api.delete(`/locker/${productId}`);
  } else {
    await api.post(`/locker/${productId}`);
  }
}

export function useLocker() {
  const qc = useQueryClient();

  const lockerQuery = useQuery<Product[]>({
    queryKey: ['locker'],
    queryFn: fetchLocker,
  });

  const mutation = useMutation({
    mutationFn: toggleLockerRequest,
    onMutate: async ({ productId, inLocker }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['locker'] });
      const prev = qc.getQueryData<Product[]>(['locker']) ?? [];

      const next = inLocker
        ? prev.filter((p) => p.id !== productId)
        : prev;

      // En caso de agregar, podrías refetch luego para tener el producto completo;
      // para MVP dejamos que el GET lo refresque tras el éxito.
      qc.setQueryData<Product[]>(['locker'], next);

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['locker'], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['locker'] });
    },
  });

  const locker = lockerQuery.data ?? [];

  const lockerIds = useMemo(
    () => new Set((locker ?? []).map((p) => p.id)),
    [locker],
  );

  const toggleLocker = (product: Product) => {
    const inLocker = lockerIds.has(product.id);
    mutation.mutate({ productId: product.id, inLocker });
  };

  return {
    locker,
    lockerIds,
    isLoading: lockerQuery.isLoading,
    isFetching: lockerQuery.isFetching,
    refetch: lockerQuery.refetch,
    toggleLocker,
    isMutating: mutation.isLoading,
  };
}
