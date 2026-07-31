import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAccentColors } from '@/src/context/AccentContext';
import { useVentas } from '@/src/hooks/useVentas';
import { type Venta } from '@/src/types';
import SwipeableRow from '@/src/components/SwipeableRow';

export default function ClientesScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { getDeudores, pagarVenta, deleteVenta, actualizarCliente } = useVentas();
  const [deudores, setDeudores] = useState<(Venta & { dias_retraso: number })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);

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

  const handleEliminarDeudor = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar esta venta permanentemente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteVenta(id); load(); } },
    ]);
  };

  const handleEditarCliente = (item: Venta & { dias_retraso: number }) => {
    setEditando({ id: item.id, nombre: item.cliente });
  };

  const guardarNombre = async () => {
    if (!editando) return;
    try {
      await actualizarCliente(editando.id, editando.nombre);
    } catch { Alert.alert('Error', 'No se pudo actualizar el cliente'); }
    finally { setEditando(null); load(); }
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

  const filtrados = deudores.filter(d =>
    d.cliente.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      {editando && (
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Editar Cliente</Text>
            <TextInput
              style={[styles.modalInput, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
              value={editando.nombre}
              onChangeText={(t) => setEditando({ ...editando, nombre: t })}
              placeholder="Nuevo nombre"
              placeholderTextColor={c.textSecondary}
              autoFocus
            />
            <View style={styles.modalAcciones}>
              <Pressable style={[styles.modalBtn, { backgroundColor: c.danger }]} onPress={() => setEditando(null)}>
                <Text style={styles.btnTexto}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: c.primary }]} onPress={guardarNombre}>
                <Text style={styles.btnTexto}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      <FlatList
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        data={filtrados}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        getItemLayout={(_, index) => ({ length: 100, offset: 100 * index, index })}
        windowSize={10}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { color: c.text }]}>👥 Deudores</Text>
            <TextInput
              style={[styles.searchInput, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
              placeholder="Buscar cliente..."
              placeholderTextColor={c.textSecondary}
              value={busqueda}
              onChangeText={setBusqueda}
            />
            {filtrados.length === 0 && (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                {busqueda ? 'No hay resultados.' : 'No hay deudores. ¡Buen trabajo!'}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableRow
            onSwipe={() => handleEliminarDeudor(item.id)}
            onEdit={() => handleEditarCliente(item)}
          >
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
                  style={[styles.btnEditar, { borderColor: c.textSecondary }]}
                  onPress={() => handleEditarCliente(item)}
                >
                  <Text style={[styles.btnRecordarTexto, { color: c.textSecondary }]}>✏️ Editar</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnRecordar, { borderColor: c.warning }]}
                  onPress={() => handleRecordar(item)}
                >
                  <Text style={[styles.btnRecordarTexto, { color: c.warning }]}>📤 Recordar</Text>
                </Pressable>
              </View>
            </View>
          </SwipeableRow>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  searchInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 12 },
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
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
  btnEditar: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  btnRecordarTexto: { fontWeight: '700', fontSize: 13 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modal: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalAcciones: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
