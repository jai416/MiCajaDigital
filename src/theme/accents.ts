export const ACCENT_COLORS = {
  esmeralda: { light: '#059669', dark: '#34D399', name: 'Esmeralda' },
  azul: { light: '#2563EB', dark: '#60A5FA', name: 'Azul' },
  morado: { light: '#7C3AED', dark: '#A78BFA', name: 'Morado' },
  naranja: { light: '#EA580C', dark: '#FB923C', name: 'Naranja' },
  rojo: { light: '#DC2626', dark: '#F87171', name: 'Rojo' },
  rosa: { light: '#DB2777', dark: '#F472B6', name: 'Rosa' },
  teal: { light: '#0D9488', dark: '#2DD4BF', name: 'Teal' },
  granate: { light: '#B91C1C', dark: '#FCA5A5', name: 'Granate' },
} as const;

export type AccentKey = keyof typeof ACCENT_COLORS;

export function accentColorFor(key: AccentKey | null | undefined, dark: boolean): string {
  if (key && ACCENT_COLORS[key]) return dark ? ACCENT_COLORS[key].dark : ACCENT_COLORS[key].light;
  return dark ? '#34D399' : '#059669';
}
