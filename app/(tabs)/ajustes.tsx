import { useState } from 'react';
import {
  Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { useBiometrica } from '@/src/hooks/useBiometrica';
import { useNotificaciones } from '@/src/hooks/useNotificaciones';
import { useSync } from '@/src/hooks/useSync';
import { useExport } from '@/src/hooks/useExport';
import { useVentas } from '@/src/hooks/useVentas';
import { useGastos } from '@/src/hooks/useGastos';

export default function AjustesScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { available: bioAvailable, enabled: bioEnabled, toggle: toggleBio } = useBiometrica();
  const { enabled: notifEnabled, deudorEnabled, permitted: notifPermitted, toggle: toggleNotif, toggleDeudores, registerPushToken } = useNotificaciones();
  const { syncing, lastSync, sincronizar } = useSync();
  const { exportTable, exportTodo, exporting } = useExport();
  const { getCuadre } = useVentas();
  const { getGastosDelDia } = useGastos();
  const [compartiendo, setCompartiendo] = useState(false);

  const compartirResumen = async () => {
    setCompartiendo(true);
    try {
      const cuadre = await getCuadre();
      const gastosHoy = await getGastosDelDia();
      const totalGastos = gastosHoy.reduce((s, g) => s + g.monto, 0);
      const ganancia = cuadre.totalVentas - totalGastos;

      const msg =
        `📊 *Mi Caja Digital - Resumen del día*\n\n` +
        `💲 Ventas: $${cuadre.totalVentas.toFixed(2)}\n` +
        `📉 Gastos: $${totalGastos.toFixed(2)}\n` +
        `✅ Ganancia: $${ganancia.toFixed(2)}\n` +
        `👥 Deudores: ${cuadre.deudores}\n` +
        `💰 Pedidos pendientes: $${cuadre.pedidosPendientes.toFixed(2)}`;

      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'WhatsApp no está instalado en este dispositivo.');
      }
    } catch {
      Alert.alert('Error', 'No se pudo obtener el resumen del día.');
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: c.text }]}>⚙️ Ajustes</Text>

      {/* Cuenta */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>👤 Cuenta</Text>
        <Text style={[styles.cardText, { color: c.textSecondary }]}>{user?.email ?? 'Sin sesión'}</Text>
      </View>

      {/* Biometrica */}
      {bioAvailable && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]}>🔒 Huella / Face ID</Text>
              <Text style={[styles.cardText, { color: c.textSecondary }]}>Desbloquear la app con tu huella o rostro</Text>
            </View>
            <Switch value={bioEnabled} onValueChange={toggleBio}
              trackColor={{ false: c.border, true: c.primary }}
              thumbColor={bioEnabled ? c.success : c.textSecondary} />
          </View>
        </View>
      )}

      {/* Recordatorio diario */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>🔔 Recordatorio diario</Text>
            <Text style={[styles.cardText, { color: c.textSecondary }]}>Recordatorio a las 8 PM para hacer tu cuadre</Text>
          </View>
          <Switch value={notifEnabled} onValueChange={toggleNotif}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor={notifEnabled ? c.success : c.textSecondary} />
        </View>
        {!notifPermitted && notifEnabled && (
          <Text style={[styles.warning, { color: c.danger }]}>Permiso de notificaciones denegado.</Text>
        )}
      </View>

      {/* Recordatorio deudores */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>🔔 Recordatorio de cobros</Text>
            <Text style={[styles.cardText, { color: c.textSecondary }]}>Notificación a las 10 AM con deudores pendientes</Text>
          </View>
          <Switch value={deudorEnabled} onValueChange={toggleDeudores}
            trackColor={{ false: c.border, true: c.danger }}
            thumbColor={deudorEnabled ? c.success : c.textSecondary} />
        </View>
      </View>

      {/* Sincronización */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>☁️ Sincronización</Text>
        <Text style={[styles.cardText, { color: c.textSecondary }]}>
          Último sync: {lastSync ? lastSync.toLocaleTimeString() : 'Nunca'}
        </Text>
        <Pressable style={[styles.botonAccion, { backgroundColor: c.primary, opacity: syncing ? 0.6 : 1 }]}
          onPress={sincronizar} disabled={syncing}>
          <Text style={styles.botonTextoBlanco}>{syncing ? 'Sincronizando...' : '☁️ Respaldar ahora'}</Text>
        </Pressable>
        <Pressable style={[styles.botonAccion, { backgroundColor: '#2563EB', marginTop: 8, opacity: syncing ? 0.6 : 1 }]}
          onPress={async () => {
            const ok = await sincronizar();
            Alert.alert('Backup', ok ? 'Datos respaldados en Supabase.' : 'Error al respaldar. Verifica tu conexión.');
          }}>
          <Text style={styles.botonTextoBlanco}>💾 Backup completo ahora</Text>
        </Pressable>
      </View>

      {/* Notificaciones push remotas */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>📲 Notificaciones push</Text>
        <Text style={[styles.cardText, { color: c.textSecondary, marginBottom: 10 }]}>
          Activa las notificaciones push remotas para recibir alertas incluso cuando la app está cerrada
        </Text>
        <Pressable style={[styles.botonAccion, { backgroundColor: '#25D366' }]}
          onPress={async () => { await registerPushToken(); Alert.alert('Listo', 'Notificaciones push activadas.'); }}>
          <Text style={styles.botonTextoBlanco}>🔔 Activar push notifications</Text>
        </Pressable>
      </View>

      {/* Exportar datos */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>📤 Exportar datos (CSV)</Text>
        <Text style={[styles.cardText, { color: c.textSecondary, marginBottom: 10 }]}>
          Descarga tus datos para abrirlos en Excel o Google Sheets
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={[styles.botonAccionSmall, { borderColor: c.primary, opacity: exporting ? 0.6 : 1 }]}
            onPress={() => exportTable('ventas', 'Ventas')} disabled={exporting}>
            <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>📊 Ventas</Text>
          </Pressable>
          <Pressable style={[styles.botonAccionSmall, { borderColor: c.danger, opacity: exporting ? 0.6 : 1 }]}
            onPress={() => exportTable('gastos', 'Gastos')} disabled={exporting}>
            <Text style={{ color: c.danger, fontWeight: '700', fontSize: 13 }}>📉 Gastos</Text>
          </Pressable>
          <Pressable style={[styles.botonAccionSmall, { borderColor: '#8B5CF6', opacity: exporting ? 0.6 : 1 }]}
            onPress={() => exportTable('catalogo', 'Catalogo')} disabled={exporting}>
            <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 13 }}>📦 Catálogo</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.botonAccion, { backgroundColor: c.textSecondary, marginTop: 10, opacity: exporting ? 0.6 : 1 }]}
          onPress={exportTodo} disabled={exporting}>
          <Text style={styles.botonTextoBlanco}>{exporting ? 'Exportando...' : '📦 Exportar todo'}</Text>
        </Pressable>
      </View>

      {/* Compartir resumen por WhatsApp */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>📤 Compartir resumen por WhatsApp</Text>
        <Text style={[styles.cardText, { color: c.textSecondary, marginBottom: 10 }]}>
          Envía el resumen del día a tu contador, socio o grupo de trabajo
        </Text>
        <Pressable style={[styles.botonAccion, { backgroundColor: '#25D366', opacity: compartiendo ? 0.6 : 1 }]}
          onPress={compartirResumen} disabled={compartiendo}>
          <Text style={styles.botonTextoBlanco}>{compartiendo ? 'Obteniendo datos...' : '📊 Compartir resumen del día'}</Text>
        </Pressable>
      </View>

      {/* Widget / atajo */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>📱 Atajo a Nueva Venta</Text>
        <Text style={[styles.cardText, { color: c.textSecondary }]}>
          Abre la app directamente en la pantalla de ventas usando el enlace:{'\n'}
          <Text style={{ fontWeight: '700', color: c.primary }}>micajadigital://ventas</Text>
          {'\n\n'}Android: crea un acceso directo desde Ajustes → Pantalla principal → Agregar acceso.
        </Text>
      </View>

      {/* Versión */}
      <Text style={[styles.version, { color: c.textSecondary }]}>Mi Caja Digital v1.2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  card: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardText: { fontSize: 14 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  warning: { fontSize: 12, marginTop: 8 },
  botonAccion: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  botonAccionSmall: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  botonTextoBlanco: { color: '#fff', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 13, marginTop: 20 },
});