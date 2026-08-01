import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import { accentColorFor, type AccentKey } from '@/src/theme/accents';

export function useAccentColor() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [accent, setAccent] = useState<AccentKey | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const row = await db.getFirstAsync<{ valor: string }>(
          "SELECT valor FROM app_config WHERE clave = 'accent_color'"
        );
        setAccent((row?.valor as AccentKey) ?? null);
      } catch { /* error silencioso */ }
    })();
  }, [db]);

  const setAccentColor = useCallback(
    async (key: AccentKey) => {
      try {
        await db.runAsync(
          "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('accent_color', ?)",
          [key]
        );
        setAccent(key);
      } catch { /* error silencioso */ }
    },
    [db]
  );

  const primary = accentColorFor(accent, dark);
  return { accent, primary, setAccentColor, dark };
}
