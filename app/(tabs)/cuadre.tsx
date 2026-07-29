import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/src/theme/colors';
import { useVentas } from '@/src/hooks/useVentas';
import { useGastos } from '@/src/hooks/useGastos';
import { type CuadreResumen } from '@/src/types';
import { useAuth } from '@/src/context/AuthContext';

export default function CuadreScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { getCuadre } = useVentas();
  const { getGastosDelDia } = useGastos();
  const { user, logout } = useAuth();
  const [cuadre, setCuadre] = useState<CuadreResumen | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [gastos, setGastos] = useState<{ id: number; concepto: string; monto: number }[]>([]);

  const load = useCallback(async () => {
    const [c, g] = await Promise.all([getCuadre(), getGastosDelDia()]);
    setCuadre(c);
    setGastos(g);
  }, [getCuadre, getGastosDelDia]);

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
                `Deudores: ${cuadre?.deudores ?? 0}`,
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: c.text }]}>📊 Cuadre del Día</Text>

      {cuadre && (
        <View style={styles.grid}>
          <Card
            label="Ventas del Día"
            value={`$${cuadre.totalVentas.toFixed(2)}`}
            bg={c.primaryLight}
            color={c.primary}
            textColor={c.text}
          />
          <Card
            label="Gastos del Día"
            value={`$${cuadre.totalGastos.toFixed(2)}`}
            bg={c.dangerLight}
            color={c.danger}
            textColor={c.text}
          />
          <Card
            label="Ganancia"
            value={`$${cuadre.ganancia.toFixed(2)}`}
            bg={cuadre.ganancia >= 0 ? c.primaryLight : c.dangerLight}
            color={cuadre.ganancia >= 0 ? c.primary : c.danger}
            textColor={c.text}
          />
          <Card
            label="Total Cobrado"
            value={`$${cuadre.totalCobrado.toFixed(2)}`}
            bg={c.primaryLight}
            color={c.primary}
            textColor={c.text}
          />
          <Card
            label="Por Cobrar"
            value={`$${cuadre.totalPendiente.toFixed(2)}`}
            bg={c.warningLight}
            color={c.warning}
            textColor={c.text}
          />
          <Card
            label="Deudores"
            value={`${cuadre.deudores}`}
            bg={c.dangerLight}
            color={c.danger}
            textColor={c.text}
          />
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
    </ScrollView>
  );
}

function Card({
  label,
  value,
  bg,
  color,
  textColor,
}: {
  label: string;
  value: string;
  bg: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={[styles.cardGrid, { backgroundColor: bg }]}>
      <Text style={[styles.cardLabel, { color }]}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  cardGrid: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '800' },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  gastoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  botonReiniciar: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  botonReiniciarTexto: { fontSize: 16, fontWeight: '700' },
  botonLogout: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
});
