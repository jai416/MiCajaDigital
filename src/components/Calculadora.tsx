import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccentColors } from '@/src/context/AccentContext';

const BOTONES = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
  ['C'],
];

export default function Calculadora({ visible, onClose, onResult }: { visible: boolean; onClose: () => void; onResult: (val: number) => void }) {
  const { theme: c } = useAccentColors();
  const [display, setDisplay] = useState('0');
  const [operador, setOperador] = useState<string | null>(null);
  const [prev, setPrev] = useState<number | null>(null);
  const [reiniciar, setReiniciar] = useState(false);

  const presionar = (b: string) => {
    if (b === 'C') {
      setDisplay('0'); setOperador(null); setPrev(null); setReiniciar(false);
      return;
    }
    if (b === '=') {
      if (prev === null || !operador) return;
      const curr = parseFloat(display);
      let res = 0;
      switch (operador) {
        case '+': res = prev + curr; break;
        case '-': res = prev - curr; break;
        case '*': res = prev * curr; break;
        case '/': if (curr === 0) { setDisplay('Error'); setPrev(null); setOperador(null); setReiniciar(true); return; } res = prev / curr; break;
      }
      setDisplay(String(Math.round(res * 100) / 100));
      setPrev(null); setOperador(null); setReiniciar(true);
      return;
    }
    if (['+', '-', '*', '/'].includes(b)) {
      const curr = parseFloat(display);
      if (prev !== null && operador) {
        let res = 0;
        switch (operador) {
          case '+': res = prev + curr; break;
          case '-': res = prev - curr; break;
          case '*': res = prev * curr; break;
          case '/': if (curr === 0) { setDisplay('Error'); setPrev(null); setOperador(null); setReiniciar(true); return; } res = prev / curr; break;
        }
        setPrev(res);
        setDisplay(String(Math.round(res * 100) / 100));
      } else {
        setPrev(curr);
      }
      setOperador(b);
      setReiniciar(true);
      return;
    }
    if (reiniciar) {
      setDisplay(b); setReiniciar(false);
    } else {
      setDisplay(display === '0' && b !== '.' ? b : display + b);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: c.surface }]} onPress={() => {}}>
          <Text style={[styles.display, { color: c.text, backgroundColor: c.background }]}>{display}</Text>
          {BOTONES.map((fila, i) => (
            <View key={i} style={styles.fila}>
              {fila.map(b => (
                <Pressable key={b} style={[styles.boton, {
                  backgroundColor: ['+', '-', '*', '/', '='].includes(b) ? c.primary : b === 'C' ? c.danger : c.background,
                }]} onPress={() => presionar(b)}>
                  <Text style={[styles.botonTexto, { color: ['+', '-', '*', '/', '=', 'C'].includes(b) ? '#fff' : c.text }]}>{b}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable
            style={[styles.botonAceptar, { borderColor: c.primary, opacity: display === 'Error' || display === 'NaN' ? 0.4 : 1 }]}
            disabled={display === 'Error' || display === 'NaN'}
            onPress={() => { onResult(parseFloat(display) || 0); onClose(); }}
          >
            <Text style={{ color: c.primary, fontWeight: '800' }}>✅ Aceptar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { borderRadius: 20, padding: 20, width: '85%' },
  display: { fontSize: 36, fontWeight: '800', textAlign: 'right', padding: 16, borderRadius: 12, marginBottom: 16, minHeight: 60 },
  fila: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  boton: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  botonTexto: { fontSize: 22, fontWeight: '700' },
  botonAceptar: { marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
});
