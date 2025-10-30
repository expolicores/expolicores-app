// frontend/src/hooks/useSelectedAddress.ts
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from '../types/address';
import { pickDefaultAddress } from '../lib/address';

const SELECTED_KEY = ['addresses', 'selected'];

export function useSelectedAddress(addresses?: Address[] | null) {
  const queryClient = useQueryClient();

  const query = useQuery<Address | null>({
    queryKey: SELECTED_KEY,
    queryFn: () => queryClient.getQueryData<Address | null>(SELECTED_KEY) ?? null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const setSelectedAddress = useCallback(
    (addr: Address | null) => {
      queryClient.setQueryData(SELECTED_KEY, addr ?? null);
    },
    [queryClient],
  );

  const list = addresses ?? null;
  const current = query.data ?? null;

  useEffect(() => {
    if (!list || list.length === 0) {
      if (current !== null) {
        queryClient.setQueryData(SELECTED_KEY, null);
      }
      return;
    }

    if (current && list.some((a) => a.id === current.id)) return;

    const fallback = pickDefaultAddress(list) ?? list[0] ?? null;
    if (fallback) {
      queryClient.setQueryData(SELECTED_KEY, fallback);
    } else if (current !== null) {
      queryClient.setQueryData(SELECTED_KEY, null);
    }
  }, [list, current, queryClient]);

  const effectiveSelected = useMemo(() => {
    if (!list || list.length === 0) return null;
    if (current && list.some((a) => a.id === current.id)) return current;
    return pickDefaultAddress(list) ?? list[0] ?? null;
  }, [list, current]);

  return {
    selectedAddress: effectiveSelected,
    setSelectedAddress,
  };
}
