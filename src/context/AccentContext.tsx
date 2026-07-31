import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useColorScheme } from '@/components/useColorScheme';
import { colors, type ThemeColors } from '@/src/theme/colors';
import { accentColorFor, ACCENT_COLORS, type AccentKey } from '@/src/theme/accents';

interface AccentContextValue {
  theme: ThemeColors;
  primary: string;
  accent: AccentKey | null;
  setAccentColor: (key: AccentKey) => Promise<void>;
}

const AccentContext = createContext<AccentContextValue>({
  theme: colors.light,
  primary: '#059669',
  accent: null,
  setAccentColor: async () => undefined,
});

export function AccentProvider({ children }: { children: ReactNode }) {
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
        const valor = row?.valor as AccentKey | undefined;
        setAccent(valor && ACCENT_COLORS[valor] ? valor : null);
      } catch { /* error silencioso */ }
    })();
  }, [db]);

  const setAccentColor = useCallback(async (key: AccentKey) => {
    try {
      await db.runAsync(
        "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('accent_color', ?)",
        [key]
      );
      setAccent(key);
    } catch { /* error silencioso */ }
  }, [db]);

  const base = dark ? colors.dark : colors.light;
  const primary = accentColorFor(accent, dark);
  const theme = useMemo(() => ({ ...base, primary }), [base, primary]);

  const value = useMemo(
    () => ({ theme, primary, accent, setAccentColor }),
    [theme, primary, accent, setAccentColor]
  );

  return (
    <AccentContext.Provider value={value}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccentColors() {
  return useContext(AccentContext);
}
