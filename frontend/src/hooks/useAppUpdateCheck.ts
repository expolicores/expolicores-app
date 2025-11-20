// frontend/src/hooks/useAppUpdateCheck.ts
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { api } from '../lib/api';
import { getAppVersion, compareSemver } from '../lib/version';
import Constants from 'expo-constants';

type AppVersionConfig = {
  minSupportedVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  storeUrls?: {
    android?: string;
    ios?: string;
  };
  messages?: {
    title?: string;
    body?: string;
    forceTitle?: string;
    forceBody?: string;
  };
};

export function useAppUpdateCheck() {
  const [config, setConfig] = useState<AppVersionConfig | null>(null);

  const [mustUpdate, setMustUpdate] = useState(false);
  const [shouldSuggestUpdate, setShouldSuggestUpdate] = useState(false);

  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function fetchConfig() {
      try {
        const res = await api.get<AppVersionConfig>('/config/app/version');
        if (canceled) return;
        const cfg = res.data;
        setConfig(cfg);

        const current = getAppVersion();
        const { minSupportedVersion, latestVersion, forceUpdate } = cfg;

        const isBelowMin =
          compareSemver(current, minSupportedVersion) === -1;
        const isBelowLatest =
          compareSemver(current, latestVersion) === -1;

        const platform = Constants.platform?.android
          ? 'android'
          : Constants.platform?.ios
          ? 'ios'
          : 'android';

        const url =
          (platform === 'android'
            ? cfg.storeUrls?.android
            : cfg.storeUrls?.ios) ?? null;
        setStoreUrl(url);

        if (forceUpdate || isBelowMin) {
          setMustUpdate(true);
          setShouldSuggestUpdate(false);
        } else if (isBelowLatest) {
          setShouldSuggestUpdate(true);
          setMustUpdate(false);
        } else {
          setMustUpdate(false);
          setShouldSuggestUpdate(false);
        }
      } catch {
        // no hacer nada si falla; no rompemos la app
      }
    }

    fetchConfig();

    return () => {
      canceled = true;
    };
  }, []);

  const openStore = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  };

  return {
    config,
    mustUpdate,
    shouldSuggestUpdate,
    openStore,
  };
}
