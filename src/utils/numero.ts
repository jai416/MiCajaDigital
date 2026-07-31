export function parseNumero(valor: string | number | undefined | null): number {
  if (valor == null) return NaN;
  const str = String(valor).trim().replace(',', '.');
  return parseFloat(str);
}
