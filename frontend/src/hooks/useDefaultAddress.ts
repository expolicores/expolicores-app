// src/hooks/useDefaultAddress.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAddresses, pickDefaultAddress } from "../lib/address";
import { useAuth } from "../context/AuthContext";

/**
 * Hook para obtener la dirección por defecto del usuario.
 * - Solo corre cuando está autenticado.
 * - Evita reintentos infinitos en 401.
 * - Devuelve también el arreglo completo por si se quiere listar.
 */
export function useDefaultAddress() {
  const { isAuthenticated } = useAuth();

  const q = useQuery({
    queryKey: ["addresses", "list"],
    queryFn: fetchAddresses,
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      if ((error?.response?.status ?? 0) === 401) return false; // token inválido/expirado
      return failureCount < 2;
    },
    // Preprocesamos el resultado para exponer también la default
    select: (addresses) => ({
      addresses,
      defaultAddress: pickDefaultAddress(addresses),
    }),
  });

  return {
    ...q,
    addresses: q.data?.addresses ?? [],
    defaultAddress: q.data?.defaultAddress ?? null,
  };
}
