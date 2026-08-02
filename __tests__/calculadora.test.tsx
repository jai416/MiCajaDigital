import { render, fireEvent } from '@testing-library/react-native';
import Calculadora from '../src/components/Calculadora';

jest.mock('../src/context/AccentContext', () => ({
  useAccentColors: () => ({
    theme: {
      surface: '#FFFFFF', background: '#F5F7FA', text: '#1A1A2E', textSecondary: '#6B7280',
      primary: '#059669', danger: '#DC2626', success: '#10B981',
    },
  }),
}));

describe('Calculadora', () => {
  const onResult = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    onResult.mockClear();
    onClose.mockClear();
  });

  it('suma 5 + 3 y devuelve 8 al aceptar', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('+'));
    fireEvent.press(getByText('3'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(8);
  });

  it('divide entre cero y deshabilita Aceptar', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('8'));
    fireEvent.press(getByText('/'));
    fireEvent.press(getByText('0'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).not.toHaveBeenCalled();
  });

  it('tras un Error, el operador no envenena (queda en Error y Aceptar sigue deshabilitado)', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('8'));
    fireEvent.press(getByText('/'));
    fireEvent.press(getByText('0'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('+'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).not.toHaveBeenCalled();
  });

  it('multiplica 6 * 7 = 42', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('6'));
    fireEvent.press(getByText('*'));
    fireEvent.press(getByText('7'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(42);
  });

  it('C limpia el display y permite empezar de nuevo', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('9'));
    fireEvent.press(getByText('C'));
    fireEvent.press(getByText('4'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(4);
  });

  it('encadena operadores correctamente (2 + 3 * 4 = 20)', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('2'));
    fireEvent.press(getByText('+'));
    fireEvent.press(getByText('3'));
    fireEvent.press(getByText('*'));
    fireEvent.press(getByText('4'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(20);
  });

  it('punto tras un resultado no produce NaN (muestra 0.)', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('4'));
    fireEvent.press(getByText('+'));
    fireEvent.press(getByText('7'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('.'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(0.5);
  });

  it('no permite dos puntos en el mismo número', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('1'));
    fireEvent.press(getByText('.'));
    fireEvent.press(getByText('.'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(1.5);
  });

  it('resta con decimales 10.5 - 0.5 = 10', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('1'));
    fireEvent.press(getByText('0'));
    fireEvent.press(getByText('.'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('-'));
    fireEvent.press(getByText('0'));
    fireEvent.press(getByText('.'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(10);
  });

  it('acepta pulsar = sin operación previa (no revienta)', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('='));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onResult).toHaveBeenCalledWith(0);
  });

  it('onClose se llama al aceptar', () => {
    const { getByText } = render(<Calculadora visible onClose={onClose} onResult={onResult} />);
    fireEvent.press(getByText('3'));
    fireEvent.press(getByText('✅ Aceptar'));
    expect(onClose).toHaveBeenCalled();
  });
});
