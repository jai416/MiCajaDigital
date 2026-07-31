import { memo, useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAccentColors } from '@/src/context/AccentContext';
import { useVentas } from '@/src/hooks/useVentas';
import { type Venta } from '@/src/types';
import SwipeableRow from '@/src/components/SwipeableRow';
import { perfStart, perfEnd } from '@/src/utils/perf';

const FILTROS = ['pendiente', 'entregado', 'cancelado'] as const;

export default function PedidosScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { getPedidos, actualizarEstadoPedido, deleteVenta } = useVentas();
  const [pedidos, setPedidos] = useState<Venta[]>([]);
  const [filtro, setFiltro] = useState<string>('pendiente');
  const [refreshing, setRefreshing] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [paginando, setPaginando] = useState(false);
  const [finAlcanzado, setFinAlcanzado] = useState(false);
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    perfStart('cargar_pedidos');
    try {
      setFinAlcanzado(false);
      setPedidos(await getPedidos(filtro === 'todos' ? undefined : filtro, PAGE_SIZE, 0));
    } finally {
      perfEnd('cargar_pedidos');
    }
  }, [getPedidos, filtro]);

  const cargarMas = useCallback(async () => {
    if (paginando || finAlcanzado) return;
    setPaginando(true);
    try {
      const mas = await getPedidos(filtro === 'todos' ? undefined : filtro, PAGE_SIZE, pedidos.length);
      if (mas.length === 0) setFinAlcanzado(true);
      else setPedidos(prev => [...prev, ...mas]);
    } finally {
      setPaginando(false);
    }
  }, [getPedidos, filtro, paginando, finAlcanzado, pedidos.length]);

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => { load(); });
    return () => task.cancel();
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const salirSeleccion = () => {
    setSeleccionando(false);
    setSeleccionados(new Set());
  };

  const batchEntregar = () => {
    const count = seleccionados.size;
    if (count === 0) return;
    Alert.alert('Entregar seleccionados', `¿Marcar ${count} pedido(s) como entregado(s)?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: '✅ Entregar',
        onPress: async () => {
          try {
            await Promise.allSettled(
              [...seleccionados].map(id => actualizarEstadoPedido(id, 'entregado'))
            );
          } finally { salirSeleccion(); load(); }
        },
      },
    ]);
  };

  const batchCancelar = () => {
    const count = seleccionados.size;
    if (count === 0) return;
    Alert.alert('Cancelar seleccionados', `¿Cancelar ${count} pedido(s)?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await Promise.allSettled(
              [...seleccionados].map(id => actualizarEstadoPedido(id, 'cancelado'))
            );
          } finally { salirSeleccion(); load(); }
        },
      },
    ]);
  };

  const handleEntregar = useCallback((id: string) => {
    Alert.alert('Entregar', '¿Marcar como entregado y saldar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: '✅ Entregado', onPress: async () => { await actualizarEstadoPedido(id, 'entregado'); load(); } },
    ]);
  }, [actualizarEstadoPedido, load]);

  const handleCancelar = useCallback((id: string) => {
    Alert.alert('Cancelar', '¿Cancelar este pedido?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => { await actualizarEstadoPedido(id, 'cancelado'); load(); } },
    ]);
  }, [actualizarEstadoPedido, load]);

  const handleEliminar = useCallback((id: string) => {
    Alert.alert('Eliminar', '¿Eliminar este pedido permanentemente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteVenta(id); load(); } },
    ]);
  }, [deleteVenta, load]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <FlatList
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        data={pedidos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        getItemLayout={(_, index) => ({ length: 80, offset: 80 * index, index })}
        windowSize={10}
        removeClippedSubviews={true}
        onEndReachedThreshold={0.4}
        onEndReached={cargarMas}
        ListFooterComponent={paginando ? <Text style={{ color: c.textSecondary, textAlign: 'center', padding: 16 }}>Cargando más…</Text> : null}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: c.text }]}>📋 Pedidos</Text>
              <Pressable
                style={[styles.selBtn, { borderColor: seleccionando ? c.danger : c.primary }]}
                onPress={() => {
                  if (seleccionando) salirSeleccion();
                  else setSeleccionando(true);
                }}
              >
                <Text style={{ color: seleccionando ? c.danger : c.primary, fontWeight: '700', fontSize: 13 }}>
                  {seleccionando ? '❌ Salir' : '☑️ Seleccionar'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.filtros}>
              {FILTROS.map((estado) => (
                <Pressable
                  key={estado}
                  style={[styles.filtroBtn, {
                    backgroundColor: filtro === estado ? c.primary : c.surface,
                    borderColor: c.primary,
                  }]}
                  onPress={() => setFiltro(estado)}
                >
                  <Text style={{
                    color: filtro === estado ? '#fff' : c.primary,
                    fontWeight: '700', fontSize: 12,
                  }}>
                    {estado === 'pendiente' ? '⏳ Pendientes' : estado === 'entregado' ? '✅ Entregados' : '❌ Cancelados'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {pedidos.length === 0 && (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                No hay pedidos {filtro !== 'todos' ? `en "${filtro}"` : ''}.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PedidoCard
            item={item}
            c={c}
            seleccionando={seleccionando}
            checked={seleccionados.has(item.id)}
            onSeleccionar={toggleSeleccion}
            onEliminar={handleEliminar}
            onEntregar={handleEntregar}
            onCancelar={handleCancelar}
          />
        )}
      />
      {seleccionando && seleccionados.size > 0 && (
        <View style={[styles.batchBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <Pressable style={[styles.batchBtn, { backgroundColor: c.primary }]} onPress={batchEntregar}>
            <Text style={styles.btnTexto}>✅ Entregar ({seleccionados.size})</Text>
          </Pressable>
          <Pressable style={[styles.batchBtn, { backgroundColor: c.danger }]} onPress={batchCancelar}>
            <Text style={styles.btnTexto}>❌ Cancelar ({seleccionados.size})</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const PedidoCard = memo(function PedidoCard({
  item, c, seleccionando, checked, onSeleccionar, onEliminar, onEntregar, onCancelar,
}: {
  item: Venta;
  c: ReturnType<typeof useAccentColors>['theme'];
  seleccionando: boolean;
  checked: boolean;
  onSeleccionar: (id: string) => void;
  onEliminar: (id: string) => void;
  onEntregar: (id: string) => void;
  onCancelar: (id: string) => void;
}) {
  return (
    <SwipeableRow
      onSwipe={() => { if (!seleccionando) onEliminar(item.id); }}
    >
      <Pressable
        onPress={() => { if (seleccionando) onSeleccionar(item.id); }}
        style={[styles.card, {
          backgroundColor: c.surface,
          borderColor: checked ? c.primary : c.border,
          borderLeftColor: item.estado_pedido === 'pendiente' ? c.warning
            : item.estado_pedido === 'entregado' ? c.primary : c.danger,
          borderLeftWidth: 4,
        }]}
      >
        <View style={styles.cardHeader}>
          {seleccionando && (
            <View style={[styles.checkbox, {
              borderColor: c.primary,
              backgroundColor: checked ? c.primary : 'transparent',
            }]}>
              {checked && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>✓</Text>}
            </View>
          )}
          <Text style={[styles.cliente, { color: c.text }]}>{item.cliente || 'Sin cliente'}</Text>
          <Text style={{
            fontSize: 12, fontWeight: '700',
            color: item.estado_pedido === 'pendiente' ? c.warning
              : item.estado_pedido === 'entregado' ? c.primary : c.danger,
          }}>
            {item.estado_pedido === 'pendiente' ? '⏳ Pendiente'
              : item.estado_pedido === 'entregado' ? '✅ Entregado' : '❌ Cancelado'}
          </Text>
        </View>
        <Text style={[styles.producto, { color: c.textSecondary }]}>
          {item.producto} — ${item.precio.toFixed(2)}
        </Text>
        <View style={styles.detalles}>
          <Text style={[styles.detalle, { color: c.textSecondary }]}>
            Anticipo: ${item.anticipo.toFixed(2)}
          </Text>
          <Text style={[styles.detalle, { color: c.danger, fontWeight: '700' }]}>
            Saldo: ${item.saldo_pendiente.toFixed(2)}
          </Text>
        </View>
        {item.fecha_entrega && (
          <Text style={[styles.detalle, { color: c.textSecondary }]}>
            📅 Entrega: {item.fecha_entrega}
          </Text>
        )}
        <Text style={[styles.detalle, { color: c.textSecondary }]}>
          📅 Creado: {item.fecha}
        </Text>
        {!seleccionando && item.estado_pedido === 'pendiente' && (
          <View style={styles.acciones}>
            <Pressable style={[styles.btn, { backgroundColor: c.primary }]} onPress={() => onEntregar(item.id)}>
              <Text style={styles.btnTexto}>✅ Entregar</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: c.danger }]} onPress={() => onCancelar(item.id)}>
              <Text style={styles.btnTexto}>❌ Cancelar</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    </SwipeableRow>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' },
  filtroBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  cliente: { fontSize: 16, fontWeight: '700', flex: 1 },
  producto: { fontSize: 14, marginTop: 4 },
  detalles: { flexDirection: 'row', gap: 16, marginTop: 4 },
  detalle: { fontSize: 13, marginTop: 2 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  batchBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 32,
  },
  batchBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
