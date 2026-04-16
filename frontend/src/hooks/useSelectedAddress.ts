// frontend/src/hooks/useSelectedAddress.ts
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from '../types/address';
import { pickDefaultAddress } from '../lib/address';

export const SELECTED_ADDRESS_QUERY_KEY = ['addresses', 'selected'] as const;

export function useSelectedAddress(addresses?: Address[] | null) {
  const queryClient = useQueryClient();

  const listReady = Array.isArray(addresses);
  const list: Address[] | null = listReady ? addresses! : null;
  const listIsEmpty = listReady && list?.length === 0;

  const query = useQuery<Address | null>({
    queryKey: SELECTED_ADDRESS_QUERY_KEY,
    queryFn: () =>
      queryClient.getQueryData<Address | null>(SELECTED_ADDRESS_QUERY_KEY) ?? null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const current = query.data ?? null;
  const listHasCurrent =
    !!current && !!list?.some((a) => a.id === current.id);

  const setSelectedAddress = useCallback(
    (addr: Address | null) => {
      queryClient.setQueryData(SELECTED_ADDRESS_QUERY_KEY, addr ?? null);
    },
    [queryClient],
  );

  useEffect(() => {
    if (listIsEmpty) {
      if (current !== null) {
        queryClient.setQueryData(SELECTED_ADDRESS_QUERY_KEY, null);
      }
      return;
    }

    if (!list || list.length === 0) return;
    if (listHasCurrent) return;

    const fallback = pickDefaultAddress(list) ?? list[0] ?? null;
    if (fallback || current !== null) {
      queryClient.setQueryData(
        SELECTED_ADDRESS_QUERY_KEY,
        fallback ?? null,
      );
    }
  }, [list, listIsEmpty, listHasCurrent, current, queryClient]);

  const effectiveSelected = useMemo(() => {
    if (current) {
      if (!listReady || listHasCurrent) return current;
    }
    if (!list || list.length === 0) return null;
    return pickDefaultAddress(list) ?? list[0] ?? null;
  }, [current, list, listReady, listHasCurrent]);

  return {
    selectedAddress: effectiveSelected,
    setSelectedAddress,
  };
}
