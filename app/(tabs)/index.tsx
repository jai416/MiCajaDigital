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
import { useVentas } from '@/src/hooks/useVentas';

export default function VentasScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { addVenta, loading } = useVentas();

  const [producto, setProducto] = useState('');
  const [precio, setPrecio] = useState('');
  const [cliente, setCliente] = useState('');
  const [tipo, setTipo] = useState<'contado' | 'fiado'>('contado');

  const handleVender = useCallback(async () => {
    if (!producto.trim()) {
      Alert.alert('Error', 'El producto es obligatorio');
      return;
    }
    const numPrecio = parseFloat(precio);
    if (isNaN(numPrecio) || numPrecio <= 0) {
      Alert.alert('Error', 'Precio inválido');
      return;
    }
    if (tipo === 'fiado' && !cliente.trim()) {
      Alert.alert('Error', 'El cliente es obligatorio para ventas fiadas');
      return;
    }

    await addVenta(producto.trim(), numPrecio, cliente.trim(), tipo);
    Alert.alert('Vendido', 'Venta guardada correctamente');
    setProducto('');
    setPrecio('');
    setCliente('');
  }, [producto, precio, cliente, tipo, addVenta]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: c.text }]}>💲 Nueva Venta</Text>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Producto *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Ej: Pan, Leche, Jabón..."
            placeholderTextColor={c.textSecondary}
            value={producto}
            onChangeText={setProducto}
          />

          <Text style={[styles.label, { color: c.textSecondary }]}>Precio *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="0.00"
            placeholderTextColor={c.textSecondary}
            keyboardType="decimal-pad"
            value={precio}
            onChangeText={setPrecio}
          />

          <View style={styles.tipoRow}>
            <Pressable
              style={[
                styles.tipoBtn,
                {
                  backgroundColor: tipo === 'contado' ? c.primary : c.surface,
                  borderColor: c.primary,
                },
              ]}
              onPress={() => setTipo('contado')}
            >
              <Text style={{ color: tipo === 'contado' ? '#fff' : c.primary, fontWeight: '700', fontSize: 15 }}>
                💵 Contado
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tipoBtn,
                {
                  backgroundColor: tipo === 'fiado' ? c.warning : c.surface,
                  borderColor: c.warning,
                },
              ]}
              onPress={() => setTipo('fiado')}
            >
              <Text style={{ color: tipo === 'fiado' ? '#fff' : c.warning, fontWeight: '700', fontSize: 15 }}>
                📝 Fiado
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: c.textSecondary }]}>
            Cliente {tipo === 'fiado' ? '*' : '(opcional)'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Nombre del cliente"
            placeholderTextColor={c.textSecondary}
            value={cliente}
            onChangeText={setCliente}
          />

          <Pressable
            style={[styles.botonGrande, { backgroundColor: c.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleVender}
            disabled={loading}
          >
            <Text style={styles.botonTexto}>💲 Vender</Text>
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
  tipoRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tipoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  botonGrande: {
    marginTop: 24,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  botonTexto: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
