import { useCallback, useEffect, useState } from "react";
import { getSetting, setSetting } from "../lib/db";

export interface AppSettings {
  zoom: number;
  outlineOpen: boolean;
}

const DEFAULTS: AppSettings = { zoom: 100, outlineOpen: false };

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const zoom = await getSetting<number>("zoom", 100);
      const outlineOpen = await getSetting<boolean>("outlineOpen", false);
      if (!alive) return;
      setSettings({ zoom, outlineOpen });
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      void setSetting("zoom", next.zoom);
      void setSetting("outlineOpen", next.outlineOpen);
      return next;
    });
  }, []);

  return { settings, loaded, update };
}
