import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/src/theme/colors';
import { useGastos } from '@/src/hooks/useGastos';

export default function GastosScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { addGasto, loading } = useGastos();

  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');

  const handleGuardar = useCallback(async () => {
    if (!concepto.trim()) {
      Alert.alert('Error', 'El concepto es obligatorio');
      return;
    }
    const numMonto = parseFloat(monto);
    if (isNaN(numMonto) || numMonto <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }

    await addGasto(concepto.trim(), numMonto);
    Alert.alert('Guardado', 'Gasto registrado correctamente');
    setConcepto('');
    setMonto('');
  }, [concepto, monto, addGasto]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: c.text }]}>📉 Registrar Gasto</Text>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Concepto *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Ej: Electricidad, Agua, Transporte..."
            placeholderTextColor={c.textSecondary}
            value={concepto}
            onChangeText={setConcepto}
          />

          <Text style={[styles.label, { color: c.textSecondary }]}>Monto *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="0.00"
            placeholderTextColor={c.textSecondary}
            keyboardType="decimal-pad"
            value={monto}
            onChangeText={setMonto}
          />

          <Pressable
            style={[styles.botonGrande, { backgroundColor: c.danger, opacity: loading ? 0.6 : 1 }]}
            onPress={handleGuardar}
            disabled={loading}
          >
            <Text style={styles.botonTexto}>📉 Guardar Gasto</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  botonGrande: {
    marginTop: 24,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  botonTexto: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
