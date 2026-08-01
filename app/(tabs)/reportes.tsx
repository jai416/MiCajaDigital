import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, InteractionManager, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAccentColors } from '@/src/context/AccentContext';
import { useVentas } from '@/src/hooks/useVentas';
import { useGastos } from '@/src/hooks/useGastos';
import type { Venta, Gasto } from '@/src/types';
import { perfStart, perfEnd } from '@/src/utils/perf';

function inicioSemana(): string {
  const d = new Date();
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(d.setDate(diff));
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
}

function inicioMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function inicioAno(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Periodo = 'semanal' | 'mensual' | 'anual';

export default function ReportesScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { getVentasEnRango } = useVentas();
  const { getGastosEnRango } = useGastos();
  const [periodo, setPeriodo] = useState<Periodo>('semanal');
  const [refreshing, setRefreshing] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);

  const load = useCallback(async (p: Periodo) => {
    perfStart('cargar_reportes');
    setCargando(true);
    try {
      const fin = hoy();
      const inicio = p === 'semanal' ? inicioSemana() : p === 'mensual' ? inicioMes() : inicioAno();
      const [v, g] = await Promise.all([getVentasEnRango(inicio, fin), getGastosEnRango(inicio, fin)]);
      setVentas(v);
      setGastos(g);
    } catch (e) {
      console.error('Error al cargar reportes:', e);
    } finally {
      perfEnd('cargar_reportes');
      setCargando(false);
    }
  }, [getVentasEnRango, getGastosEnRango]);

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => { load(periodo); });
    return () => task.cancel();
  }, [load, periodo]));

  const cambiarPeriodo = (p: Periodo) => {
    setPeriodo(p);
    load(p);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(periodo);
    setRefreshing(false);
  };

  const totalVentas = useMemo(() => ventas.reduce((s, v) => s + (v.pagado ? v.precio : 0), 0), [ventas]);
  const totalGastos = useMemo(() => gastos.reduce((s, g) => s + g.monto, 0), [gastos]);
  const ganancia = totalVentas - totalGastos;

  const porMoneda = useMemo(() => {
    const res: Record<'CUP' | 'USD' | 'MLC', number> = { CUP: 0, USD: 0, MLC: 0 };
    for (const v of ventas) {
      if (!v.pagado) continue;
      const m = (v.moneda || 'CUP') as 'CUP' | 'USD' | 'MLC';
      res[m] = (res[m] ?? 0) + v.precio;
    }
    return res;
  }, [ventas]);

  const topProductos = useMemo(() => {
    const map = new Map<string, { total: number; veces: number }>();
    for (const v of ventas) {
      if (!v.pagado) continue;
      const e = map.get(v.producto) ?? { total: 0, veces: 0 };
      e.total += v.precio;
      e.veces++;
      map.set(v.producto, e);
    }
    return [...map.entries()]
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [ventas]);

  return (
    <ScrollView style={[styles.flex, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: c.text }]}>📊 Reportes</Text>

      {cargando && (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={{ color: c.textSecondary, marginTop: 10 }}>Cargando reportes…</Text>
        </View>
      )}

      <View style={styles.periodoRow}>
        <Pressable style={[styles.periodoBtn, { backgroundColor: periodo === 'semanal' ? c.primary : c.surface, borderColor: c.primary }]}
          onPress={() => cambiarPeriodo('semanal')}>
          <Text style={{ color: periodo === 'semanal' ? '#fff' : c.primary, fontWeight: '700' }}>📅 Semanal</Text>
        </Pressable>
        <Pressable style={[styles.periodoBtn, { backgroundColor: periodo === 'mensual' ? c.primary : c.surface, borderColor: c.primary }]}
          onPress={() => cambiarPeriodo('mensual')}>
          <Text style={{ color: periodo === 'mensual' ? '#fff' : c.primary, fontWeight: '700' }}>📅 Mensual</Text>
        </Pressable>
        <Pressable style={[styles.periodoBtn, { backgroundColor: periodo === 'anual' ? c.primary : c.surface, borderColor: c.primary }]}
          onPress={() => cambiarPeriodo('anual')}>
          <Text style={{ color: periodo === 'anual' ? '#fff' : c.primary, fontWeight: '700' }}>📅 Anual</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Card label="Ventas" value={`$${totalVentas.toFixed(2)}`} bg={c.primaryLight} color={c.primary} />
        <Card label="Gastos" value={`$${totalGastos.toFixed(2)}`} bg={c.dangerLight} color={c.danger} />
        <Card label="Ganancia" value={`$${ganancia.toFixed(2)}`}
          bg={ganancia >= 0 ? c.primaryLight : c.dangerLight}
          color={ganancia >= 0 ? c.primary : c.danger} />
        <Card label="Ventas" value={ventas.length.toString()} bg={c.surface} color={c.text} />
      </View>

      {(porMoneda.CUP > 0 || porMoneda.USD > 0 || porMoneda.MLC > 0) && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>💱 Ventas por moneda</Text>
          {(['CUP', 'USD', 'MLC'] as const).map((mon) => {
            if ((porMoneda[mon] ?? 0) <= 0) return null;
            return (
              <View key={mon} style={styles.topRow}>
                <Text style={{ color: c.text, flex: 1 }}>{mon}</Text>
                <Text style={{ color: c.primary, fontWeight: '700' }}>${(porMoneda[mon] ?? 0).toFixed(2)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {topProductos.length > 0 && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>🏆 Top productos</Text>
          {topProductos.slice(0, 5).map((p, i) => (
            <View key={p.nombre} style={styles.topRow}>
              <Text style={{ color: c.text, flex: 1 }}>{i + 1}. {p.nombre}</Text>
              <Text style={{ color: c.primary, fontWeight: '700' }}>${p.total.toFixed(2)}</Text>
              <Text style={{ color: c.textSecondary, marginLeft: 8, fontSize: 12 }}>×{p.veces}</Text>
            </View>
          ))}
        </View>
      )}

      {totalVentas > 0 && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>📊 Ventas vs Gastos</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 24, height: 184, justifyContent: 'center', marginVertical: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 50, height: Math.max(4, (totalVentas / Math.max(totalVentas, totalGastos, 1)) * 160), backgroundColor: c.primary, borderRadius: 8 }} />
              <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 4, fontWeight: '600' }}>Ventas</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 50, height: Math.max(4, (totalGastos / Math.max(totalVentas, totalGastos, 1)) * 160), backgroundColor: c.danger, borderRadius: 8 }} />
              <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 4, fontWeight: '600' }}>Gastos</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const Card = memo(function Card({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) {
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
  periodoRow: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' },
  periodoBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  cardGrid: { width: '47%', borderRadius: 14, padding: 16, elevation: 2 },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '800' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0 },
});