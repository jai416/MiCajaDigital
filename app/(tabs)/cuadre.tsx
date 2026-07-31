import { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, InteractionManager, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAccentColors } from '@/src/context/AccentContext';
import { useVentas } from '@/src/hooks/useVentas';
import { useGastos } from '@/src/hooks/useGastos';
import { type CuadreResumen, type Venta, type Gasto } from '@/src/types';
import { perfStart, perfEnd } from '@/src/utils/perf';
import { useAuth } from '@/src/context/AuthContext';

function BarChart({ ventas, gastos, maxH = 160 }: { ventas: number; gastos: number; maxH?: number }) {
  const { theme: c } = useAccentColors();
  const max = Math.max(ventas, gastos, 1);
  const hV = (ventas / max) * maxH;
  const hG = (gastos / max) * maxH;

  return (
    <View style={{ marginVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 24, height: maxH + 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 50, height: hV, backgroundColor: c.primary, borderRadius: 8, minHeight: 4 }} />
          <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 4, fontWeight: '600' }}>Ventas</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 50, height: hG, backgroundColor: c.danger, borderRadius: 8, minHeight: 4 }} />
          <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 4, fontWeight: '600' }}>Gastos</Text>
        </View>
      </View>
    </View>
  );
}

export default function CuadreScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { getCuadre, getVentasDelDia, updateVenta, deleteVenta } = useVentas();
  const { getGastosDelDia } = useGastos();
  const { user, logout } = useAuth();
  const [cuadre, setCuadre] = useState<CuadreResumen | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ventasDia, setVentasDia] = useState<Venta[]>([]);
  const [editVenta, setEditVenta] = useState<Venta | null>(null);
  const [editProducto, setEditProducto] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
  const [editMoneda, setEditMoneda] = useState<'CUP' | 'USD' | 'MLC'>('CUP');
  const [editCosto, setEditCosto] = useState('');

  const load = useCallback(async () => {
    perfStart('cargar_cuadre');
    setCargando(true);
    try {
      const [c, g, v] = await Promise.all([getCuadre(), getGastosDelDia(), getVentasDelDia()]);
      setCuadre(c);
      setGastos(g);
      setVentasDia(v);
    } catch (e) {
      console.error('Error al cargar cuadre:', e);
    } finally {
      perfEnd('cargar_cuadre');
      setCargando(false);
    }
  }, [getCuadre, getGastosDelDia, getVentasDelDia]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => { load(); });
      return () => task.cancel();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleReiniciar = () => {
    Alert.alert(
      'Reiniciar Día',
      'Esto mostrará el resumen de cierre del día. No se borrará ningún dato.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ver Resumen',
          onPress: () => {
            Alert.alert(
              '📋 Cierre del Día',
              `Ventas: $${cuadre?.totalVentas.toFixed(2) ?? '0.00'}\n` +
                `Gastos: $${cuadre?.totalGastos.toFixed(2) ?? '0.00'}\n` +
                `Ganancia: $${cuadre?.ganancia.toFixed(2) ?? '0.00'}\n` +
                `Cobrado: $${cuadre?.totalCobrado.toFixed(2) ?? '0.00'}\n` +
                `Pendiente: $${cuadre?.totalPendiente.toFixed(2) ?? '0.00'}\n` +
                `Deudores: ${cuadre?.deudores ?? 0}\n` +
                `Pedidos Pendientes: $${cuadre?.pedidosPendientes.toFixed(2) ?? '0.00'}\n` +
                `Pedidos Entregados Hoy: $${cuadre?.pedidosEntregadosHoy.toFixed(2) ?? '0.00'}`,
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const handleEditVenta = (v: Venta) => {
    setEditVenta(v);
    setEditProducto(v.producto);
    setEditPrecio(v.precio.toString());
    setEditMoneda(v.moneda || 'CUP');
    setEditCosto(v.costo ? v.costo.toString() : '');
  };

  const guardarEditVenta = async () => {
    if (!editVenta) return;
    const p = parseFloat(editPrecio);
    if (isNaN(p) || p <= 0) { Alert.alert('Error', 'Precio inválido'); return; }
    if (!editProducto.trim()) { Alert.alert('Error', 'Producto obligatorio'); return; }
    try {
      const costoVal = parseFloat(editCosto);
      await updateVenta(editVenta.id, {
        producto: editProducto.trim(),
        precio: p,
        moneda: editMoneda,
        costo: isNaN(costoVal) ? undefined : costoVal,
      });
    } catch { Alert.alert('Error', 'No se pudo actualizar la venta'); }
    finally { setEditVenta(null); load(); }
  };

  const handleDeleteVenta = (id: string) => {
    Alert.alert('Eliminar venta', '¿Eliminar esta venta permanentemente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteVenta(id); load(); } },
    ]);
  };

  const m = cuadre?.metodosPago;
  const totalMetodos = m ? m.efectivo + m.tarjeta + m.transferencia : 0;

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: c.text }]}>📊 Cuadre del Día</Text>

      {cargando && (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={{ color: c.textSecondary, marginTop: 10 }}>Cargando cuadre…</Text>
        </View>
      )}

      {cuadre && (
        <>
          <View style={styles.grid}>
            <StatCard label="Ventas del Día" value={`$${cuadre.totalVentas.toFixed(2)}`} bg={c.primaryLight} color={c.primary} />
            <StatCard label="Gastos del Día" value={`$${cuadre.totalGastos.toFixed(2)}`} bg={c.dangerLight} color={c.danger} />
            <StatCard label="Ganancia" value={`$${cuadre.ganancia.toFixed(2)}`} bg={cuadre.ganancia >= 0 ? c.primaryLight : c.dangerLight} color={cuadre.ganancia >= 0 ? c.primary : c.danger} />
            <StatCard label="Total Cobrado" value={`$${cuadre.totalCobrado.toFixed(2)}`} bg={c.primaryLight} color={c.primary} />
            <StatCard label="Por Cobrar" value={`$${cuadre.totalPendiente.toFixed(2)}`} bg={c.warningLight} color={c.warning} />
            <StatCard label="Deudores" value={`${cuadre.deudores}`} bg={c.dangerLight} color={c.danger} />
            {cuadre.pedidosPendientes > 0 && (
              <StatCard label="Pedidos Pendientes" value={`$${cuadre.pedidosPendientes.toFixed(2)}`} bg="#F3E8FF" color="#8B5CF6" />
            )}
            {cuadre.pedidosEntregadosHoy > 0 && (
              <StatCard label="Pedidos Entregados Hoy" value={`$${cuadre.pedidosEntregadosHoy.toFixed(2)}`} bg="#E8F5E9" color="#16A34A" />
            )}
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>📊 Ventas vs Gastos</Text>
            <BarChart ventas={cuadre.totalVentas} gastos={cuadre.totalGastos} />
          </View>

          {totalMetodos > 0 && (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>💳 Métodos de pago hoy</Text>
              {m && (
                <>
                  <View style={styles.metodoRow}>
                    <Text style={{ color: c.text, flex: 1 }}>💰 Efectivo</Text>
                    <Text style={{ color: c.primary, fontWeight: '700' }}>${m.efectivo.toFixed(2)}</Text>
                  </View>
                  <View style={styles.metodoRow}>
                    <Text style={{ color: c.text, flex: 1 }}>💳 Tarjeta</Text>
                    <Text style={{ color: '#6366F1', fontWeight: '700' }}>${m.tarjeta.toFixed(2)}</Text>
                  </View>
                  <View style={styles.metodoRow}>
                    <Text style={{ color: c.text, flex: 1 }}>📲 Transferencia</Text>
                    <Text style={{ color: '#8B5CF6', fontWeight: '700' }}>${m.transferencia.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.sugerencia, { backgroundColor: c.primaryLight }]}>
                    <Text style={[styles.sugerenciaTexto, { color: c.primary }]}>{m.sugerencia}</Text>
                  </View>
                </>
              )}
            </View>
          )}
        </>
      )}

      {ventasDia.length > 0 && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>🛒 Ventas de Hoy</Text>
          {ventasDia.map((v) => (
            <View key={v.id} style={[styles.ventaRow, { borderBottomColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{v.producto}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12 }}>{v.cliente || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: c.primary, fontWeight: '700' }}>${v.precio.toFixed(2)}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 11 }}>{v.metodo_pago} · {v.moneda || 'CUP'}</Text>
                {v.costo > 0 && (
                  <Text style={{ color: v.precio - v.costo > 0 ? '#16A34A' : c.danger, fontSize: 11 }}>
                    Ganancia: ${(v.precio - v.costo).toFixed(2)}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                <Pressable onPress={() => handleEditVenta(v)}>
                  <Text style={{ fontSize: 16, padding: 4 }}>✏️</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteVenta(v.id)}>
                  <Text style={{ fontSize: 16, padding: 4 }}>🗑️</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {gastos.length > 0 && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Gastos de Hoy</Text>
          {gastos.map((g) => (
            <View key={g.id} style={[styles.gastoRow, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.text, flex: 1 }}>{g.concepto}</Text>
              <Text style={{ color: c.danger, fontWeight: '700' }}>-${g.monto.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.botonReiniciar, { borderColor: c.danger }]}
        onPress={handleReiniciar}
      >
        <Text style={[styles.botonReiniciarTexto, { color: c.danger }]}>🔄 Reiniciar Día (solo resumen)</Text>
      </Pressable>

      {user && (
        <Pressable
          style={[styles.botonLogout, { borderColor: c.border }]}
          onPress={() =>
            Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: () => { logout(); router.replace('/auth/login'); } },
            ])
          }
        >
          <Text style={[styles.botonReiniciarTexto, { color: c.textSecondary }]}>
            👤 {user.email} — Cerrar Sesión
          </Text>
        </Pressable>
      )}

      {/* Modal editar venta */}
      <Modal visible={!!editVenta} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>✏️ Editar Venta</Text>
            <Text style={[styles.label, { color: c.textSecondary }]}>Producto</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={editProducto} onChangeText={setEditProducto} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Precio</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={editPrecio} onChangeText={setEditPrecio} keyboardType="decimal-pad" />
            <Text style={[styles.label, { color: c.textSecondary }]}>Moneda</Text>
            <View style={styles.pickerRow}>
              {(['CUP', 'USD', 'MLC'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[
                    styles.pickerOption,
                    {
                      backgroundColor: editMoneda === m ? c.primary : c.background,
                      borderColor: editMoneda === m ? c.primary : c.border,
                    },
                  ]}
                  onPress={() => setEditMoneda(m)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: editMoneda === m ? '#fff' : c.text },
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.label, { color: c.textSecondary }]}>Costo</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={editCosto} onChangeText={setEditCosto} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSecondary} />
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]} onPress={() => setEditVenta(null)}>
                <Text style={[styles.btnTexto, { color: c.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: c.primary }]} onPress={guardarEditVenta}>
                <Text style={[styles.btnTexto, { color: '#fff' }]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const StatCard = memo(function StatCard({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) {
  return (
    <View style={[styles.cardGrid, { backgroundColor: bg }]}>
      <Text style={[styles.cardLabel, { color }]}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  cardGrid: { width: '47%', borderRadius: 14, padding: 16, elevation: 2 },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '800' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  gastoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  ventaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  metodoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0 },
  sugerencia: { marginTop: 12, padding: 12, borderRadius: 10 },
  sugerenciaTexto: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  botonReiniciar: { marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  botonReiniciarTexto: { fontSize: 16, fontWeight: '700' },
  botonLogout: { marginTop: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: '85%', borderRadius: 16, padding: 24, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnTexto: { fontSize: 16, fontWeight: '700' },
  pickerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pickerOption: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  pickerOptionText: { fontSize: 14, fontWeight: '700' },
});
