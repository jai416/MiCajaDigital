import { parseNumero } from '../src/utils/numero';

describe('parseNumero', () => {
  it('parsea enteros', () => {
    expect(parseNumero('100')).toBe(100);
  });

  it('parsea decimales con punto', () => {
    expect(parseNumero('1.5')).toBe(1.5);
  });

  it('parsea decimales con coma (locales hispanos)', () => {
    expect(parseNumero('1,5')).toBe(1.5);
  });

  it('normaliza espacios', () => {
    expect(parseNumero('  42  ')).toBe(42);
  });

  it('retorna NaN para entrada inválida', () => {
    expect(Number.isNaN(parseNumero('abc'))).toBe(true);
  });

  it('retorna NaN para null/undefined', () => {
    expect(Number.isNaN(parseNumero(null))).toBe(true);
    expect(Number.isNaN(parseNumero(undefined))).toBe(true);
  });
});
