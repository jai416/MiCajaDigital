export function parseNumero(valor: string | number | undefined | null): number {
  if (valor == null) return NaN;
  let str = String(valor).trim();
  if (!str) return NaN;

  const tieneComa = str.includes(',');
  const tienePunto = str.includes('.');

  if (tieneComa && tienePunto) {
    const ultimaComa = str.lastIndexOf(',');
    const ultimoPunto = str.lastIndexOf('.');
    if (ultimoPunto > ultimaComa) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (tieneComa && !tienePunto) {
    const partes = str.split(',');
    str = partes.length > 2 ? partes.join('') : str.replace(',', '.');
  }

  return parseFloat(str);
}
