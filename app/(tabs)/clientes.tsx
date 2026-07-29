import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/src/theme/colors';
import { useVentas } from '@/src/hooks/useVentas';
import { type Venta } from '@/src/types';

export default function ClientesScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { getDeudores, pagarVenta } = useVentas();
  const [deudores, setDeudores] = useState<(Venta & { dias_retraso: number })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const d = await getDeudores();
    setDeudores(d);
  }, [getDeudores]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePagar = (id: string) => {
    Alert.alert('Confirmar', '¿Marcar esta venta como pagada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: '✅ Pagó',
        onPress: async () => {
          await pagarVenta(id);
          load();
        },
      },
    ]);
  };

  const handleRecordar = async (item: Venta & { dias_retraso: number }) => {
    const mensaje =
      `Hola ${item.cliente}, tu saldo pendiente es de $${item.precio.toFixed(2)}. ` +
      `Producto: ${item.producto}. Fecha: ${item.fecha}. ` +
      `¿Cuándo puedes pasar a pagar?`;

    await Clipboard.setStringAsync(mensaje);

    const waUrl = `whatsapp://send?text=${encodeURIComponent(mensaje)}`;
    const soporta = await Linking.canOpenURL(waUrl);

    if (soporta) {
      Alert.alert('📤 Recordar', '¿Abrir WhatsApp con el mensaje listo?', [
        { text: 'Solo copiar', style: 'cancel' },
        { text: 'Abrir WhatsApp', onPress: () => Linking.openURL(waUrl) },
      ]);
    } else {
      Alert.alert(
        '📋 Copiado',
        'Mensaje copiado al portapapeles. Pégalo en WhatsApp para enviarlo.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <FlatList
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        data={deudores}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { color: c.text }]}>👥 Deudores</Text>
            {deudores.length === 0 && (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                No hay deudores. ¡Buen trabajo!
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                borderLeftColor: item.dias_retraso > 7 ? c.danger : item.dias_retraso > 3 ? c.warning : c.primary,
                borderLeftWidth: 4,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cliente, { color: c.text }]}>{item.cliente || 'Sin nombre'}</Text>
              <Text
                style={[
                  styles.dias,
                  {
                    color:
                      item.dias_retraso > 7 ? c.danger : item.dias_retraso > 3 ? c.warning : c.textSecondary,
                  },
                ]}
              >
                {item.dias_retraso === 0 ? 'Hoy' : `${item.dias_retraso} días`}
              </Text>
            </View>
            <Text style={[styles.producto, { color: c.textSecondary }]}>
              {item.producto} — ${item.precio.toFixed(2)}
            </Text>
            <Text style={[styles.fecha, { color: c.textSecondary }]}>📅 {item.fecha}</Text>

            <View style={styles.acciones}>
              <Pressable
                style={[styles.btnPagar, { backgroundColor: c.primary }]}
                onPress={() => handlePagar(item.id)}
              >
                <Text style={styles.btnTexto}>✅ Pagó</Text>
              </Pressable>
              <Pressable
                style={[styles.btnRecordar, { borderColor: c.warning }]}
                onPress={() => handleRecordar(item)}
              >
                <Text style={[styles.btnRecordarTexto, { color: c.warning }]}>📤 Recordar</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cliente: { fontSize: 17, fontWeight: '700' },
  dias: { fontSize: 13, fontWeight: '600' },
  producto: { fontSize: 15, marginTop: 4 },
  fecha: { fontSize: 13, marginTop: 2 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnPagar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnRecordar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
  btnRecordarTexto: { fontWeight: '700', fontSize: 15 },
});
