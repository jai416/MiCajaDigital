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

  it('parsea formato hispano con miles y decimales (1.234,56)', () => {
    expect(parseNumero('1.234,56')).toBe(1234.56);
  });

  it('parsea miles con comas sin decimales (1,234)', () => {
    expect(parseNumero('1,234,567')).toBe(1234567);
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

  it('retorna NaN para string vacío', () => {
    expect(Number.isNaN(parseNumero(''))).toBe(true);
    expect(Number.isNaN(parseNumero('   '))).toBe(true);
  });

  it('retorna NaN para prefijos no numéricos', () => {
    expect(Number.isNaN(parseNumero('$50'))).toBe(true);
    expect(Number.isNaN(parseNumero('CUP 50'))).toBe(true);
    expect(Number.isNaN(parseNumero('abc123'))).toBe(true);
  });

  it('acepta números negativos', () => {
    expect(parseNumero('-10')).toBe(-10);
    expect(parseNumero('-10,5')).toBe(-10.5);
  });

  it('acepta valores numéricos ya tipados', () => {
    expect(parseNumero(42)).toBe(42);
    expect(parseNumero(3.14)).toBe(3.14);
  });

  it('combina miles con punto y decimales con coma correctamente', () => {
    expect(parseNumero('1.234,56')).toBe(1234.56);
    expect(parseNumero('12.345,67')).toBe(12345.67);
  });

  it('miles con comas y decimales con punto se colapsan', () => {
    expect(parseNumero('1,234.56')).toBe(1234.56);
  });

  it('retorna NaN si solo hay separadores', () => {
    expect(Number.isNaN(parseNumero(',,'))).toBe(true);
    expect(Number.isNaN(parseNumero('..'))).toBe(true);
  });
});
