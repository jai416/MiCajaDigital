export function generarUUID(): string {
  const chars = '0123456789abcdef';
  const sections = [8, 4, 4, 4, 12];
  return sections
    .map((len) => {
      let s = '';
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
      return s;
    })
    .join('-');
}
