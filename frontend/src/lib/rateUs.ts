// frontend/src/lib/rateUs.ts
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as StoreReview from 'expo-store-review';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'rate_us_state_v1';

type RateUsState = {
  hasRated: boolean;
  hasDismissed: boolean;
  launchCount: number;
};

async function loadState(): Promise<RateUsState> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) {
      return { hasRated: false, hasDismissed: false, launchCount: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      hasRated: !!parsed.hasRated,
      hasDismissed: !!parsed.hasDismissed,
      launchCount: typeof parsed.launchCount === 'number' ? parsed.launchCount : 0,
    };
  } catch {
    return { hasRated: false, hasDismissed: false, launchCount: 0 };
  }
}

async function saveState(state: RateUsState) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no rompemos la app si falla
  }
}

async function triggerStoreReview() {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // si falla, seguimos al fallback
  }

  // Fallback: abrir ficha de la app en la tienda
  try {
    const url = StoreReview.storeUrl();
    if (url) {
      await Linking.openURL(url);
    }
  } catch {
    // swallow
  }
}

/**
 * Hook global para mostrar el popup de "Califícanos".
 * - Incrementa contador de lanzamientos.
 * - Si se supera minLaunches y el usuario no ha calificado ni rechazado, muestra el modal.
 */
export function useRateUsPrompt(options?: { minLaunches?: number }) {
  const minLaunches = options?.minLaunches ?? 3; // ej: a la 3ra vez que usa la app
  const [visible, setVisible] = useState(false);
  const stateRef = useRef<RateUsState | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const available = await StoreReview.isAvailableAsync();
      if (!available) return;

      let state = await loadState();
      state.launchCount += 1;

      if (!cancelled) {
        stateRef.current = state;
      }

      await saveState(state);

      if (state.hasRated || state.hasDismissed) return;

      if (state.launchCount >= minLaunches && !cancelled) {
        setVisible(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [minLaunches]);

  const handleRateNow = async () => {
    await triggerStoreReview();
    let state = stateRef.current ?? (await loadState());
    state = { ...state, hasRated: true };
    stateRef.current = state;
    await saveState(state);
    setVisible(false);
  };

  const handleNoThanks = async () => {
    let state = stateRef.current ?? (await loadState());
    state = { ...state, hasDismissed: true };
    stateRef.current = state;
    await saveState(state);
    setVisible(false);
  };

  return {
    showRateUs: visible,
    onRateNow: handleRateNow,
    onNoThanks: handleNoThanks,
  };
}

/**
 * Útil para un botón manual en Perfil: "Califícanos en la tienda"
 */
export async function openStoreListing() {
  try {
    const url = StoreReview.storeUrl();
    if (url) {
      await Linking.openURL(url);
    } else {
      await triggerStoreReview();
    }
  } catch {
    await triggerStoreReview();
  }
}
