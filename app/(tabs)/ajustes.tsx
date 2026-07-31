import { useCallback, useState } from 'react';
import {
  Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/src/theme/colors';
import { ACCENT_COLORS } from '@/src/theme/accents';
import { useAccentColors } from '@/src/context/AccentContext';
import { useAuth } from '@/src/context/AuthContext';
import { useBiometrica } from '@/src/hooks/useBiometrica';
import { useNotificaciones } from '@/src/hooks/useNotificaciones';
import { useSync } from '@/src/hooks/useSync';
import { useExport } from '@/src/hooks/useExport';
import { useVentas } from '@/src/hooks/useVentas';
import { registrarBackupAutomatico, desregistrarBackupAutomatico, estadoBackupAutomatico } from '@/src/services/backup';

export default function AjustesScreen() {
  const scheme = useColorScheme();
  const { theme: c, accent, setAccentColor } = useAccentColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { available: bioAvailable, enabled: bioEnabled, toggle: toggleBio } = useBiometrica();
  const { enabled: notifEnabled, deudorEnabled, permitted: notifPermitted, toggle: toggleNotif, toggleDeudores, registerPushToken, rescheduleDaily, rescheduleDeudor } = useNotificaciones();
  const { syncing, lastSync, sincronizar } = useSync();
  const { exportTable, exportTodo, exportToPDF, exporting } = useExport();
  const { getCuadre } = useVentas();
  const [compartiendo, setCompartiendo] = useState(false);

  // Time picker state
  const [notifHora, setNotifHora] = useState(20);
  const [notifMinuto, setNotifMinuto] = useState(0);
  const [deudorHora, setDeudorHora] = useState(10);
  const [deudorMinuto, setDeudorMinuto] = useState(0);

  // Sync log state
  const [syncLog, setSyncLog] = useState<Array<{
    id: string; user_id: string; timestamp: string;
    ventas: number; gastos: number; catalogo: number; compras: number; error: string | null;
  }>>([]);

  // Auto backup state
  const [backupAuto, setBackupAuto] = useState(false);

  const loadBackupState = useCallback(async () => {
    const row = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'auto_backup'"
    );
    const persistido = row?.valor === 'si';
    const registrado = await estadoBackupAutomatico();
    setBackupAuto(persistido || registrado);
  }, [db]);

  const toggleBackupAuto = useCallback(async (on: boolean) => {
    const prev = backupAuto;
    setBackupAuto(on);
    try {
      await db.runAsync(
        "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('auto_backup', ?)",
        [on ? 'si' : 'no']
      );
      if (on) {
        await registrarBackupAutomatico(12 * 60);
        Alert.alert('Backup automático', 'Tu negocio se respaldará automáticamente cada 12 horas.');
      } else {
        await desregistrarBackupAutomatico();
      }
    } catch {
      setBackupAuto(prev);
      Alert.alert('Error', 'No se pudo cambiar el backup automático.');
    }
  }, [db, backupAuto]);

  const loadTimes = useCallback(async () => {
    const hRow = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'notif_recordatorio_hora'"
    );
    const mRow = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'notif_recordatorio_minuto'"
    );
    setNotifHora(parseInt(hRow?.valor ?? '20'));
    setNotifMinuto(parseInt(mRow?.valor ?? '0'));

    const dhRow = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'notif_deudor_hora'"
    );
    const dmRow = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'notif_deudor_minuto'"
    );
    setDeudorHora(parseInt(dhRow?.valor ?? '10'));
    setDeudorMinuto(parseInt(dmRow?.valor ?? '0'));
  }, [db]);

  const loadSyncLog = useCallback(async () => {
    const userId = user?.id ?? '';
    if (!userId) return;
    const rows = await db.getAllAsync<{
      id: string; user_id: string; timestamp: string;
      ventas: number; gastos: number; catalogo: number; compras: number; error: string | null;
    }>(
      'SELECT * FROM sync_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10',
      [userId]
    );
    setSyncLog(rows);
  }, [db, user]);

  useFocusEffect(useCallback(() => {
    loadTimes();
    loadSyncLog();
    loadBackupState();
  }, [loadTimes, loadSyncLog, loadBackupState]));

  const saveNotifTime = useCallback(async (hora: number, minuto: number) => {
    setNotifHora(hora);
    setNotifMinuto(minuto);
    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_recordatorio_hora', ?)",
      [String(hora)]
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_recordatorio_minuto', ?)",
      [String(minuto)]
    );
    if (notifEnabled) {
      await rescheduleDaily();
    }
  }, [db, notifEnabled, rescheduleDaily]);

  const saveDeudorTime = useCallback(async (hora: number, minuto: number) => {
    setDeudorHora(hora);
    setDeudorMinuto(minuto);
    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_deudor_hora', ?)",
      [String(hora)]
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_deudor_minuto', ?)",
      [String(minuto)]
    );
    if (deudorEnabled) {
      await rescheduleDeudor();
    }
  }, [db, deudorEnabled, rescheduleDeudor]);

  const compartirResumen = async () => {
    setCompartiendo(true);
    try {
      const cuadre = await getCuadre();
      const totalGastos = cuadre.totalGastos;
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
            <Text style={[styles.cardText, { color: c.textSecondary }]}>Recordatorio para hacer tu cuadre</Text>
          </View>
          <Switch value={notifEnabled} onValueChange={toggleNotif}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor={notifEnabled ? c.success : c.textSecondary} />
        </View>
        {!notifPermitted && notifEnabled && (
          <Text style={[styles.warning, { color: c.danger }]}>Permiso de notificaciones denegado.</Text>
        )}
        {notifEnabled && (
          <TimePicker
            hora={notifHora}
            minuto={notifMinuto}
            onChange={saveNotifTime}
            colors={c}
          />
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
        {deudorEnabled && (
          <TimePicker
            hora={deudorHora}
            minuto={deudorMinuto}
            onChange={saveDeudorTime}
            colors={c}
          />
        )}
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

      {/* Backup automático */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>🔄 Backup automático</Text>
            <Text style={[styles.cardText, { color: c.textSecondary }]}>Respaldar datos localmente cada 12 horas (incluso sin conexión)</Text>
          </View>
          <Switch value={backupAuto} onValueChange={toggleBackupAuto}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor={backupAuto ? c.success : c.textSecondary} />
        </View>
      </View>

      {/* Tema de color */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>🎨 Color del tema</Text>
        <Text style={[styles.cardText, { color: c.textSecondary, marginBottom: 10 }]}>
          Personaliza el color principal de la app
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(ACCENT_COLORS) as (keyof typeof ACCENT_COLORS)[]).map(key => {
            const selected = accent === key;
            const color = scheme === 'dark' ? ACCENT_COLORS[key].dark : ACCENT_COLORS[key].light;
            return (
              <Pressable
                key={key}
                onPress={() => setAccentColor(key)}
                style={[styles.colorDot, { backgroundColor: color, borderColor: selected ? c.text : 'transparent' }]}
              >
                {selected ? <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.cardText, { color: c.textSecondary, marginTop: 8, fontSize: 13 }]}>
          {accent && ACCENT_COLORS[accent] ? ACCENT_COLORS[accent].name : 'Esmeralda (predeterminado)'}
        </Text>
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
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable style={[styles.botonAccionSmall, { borderColor: '#DC2626', opacity: exporting ? 0.6 : 1 }]}
            onPress={() => exportToPDF('ventas', 'Ventas')} disabled={exporting}>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>📄 Ventas PDF</Text>
          </Pressable>
          <Pressable style={[styles.botonAccionSmall, { borderColor: '#DC2626', opacity: exporting ? 0.6 : 1 }]}
            onPress={() => exportToPDF('gastos', 'Gastos')} disabled={exporting}>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>📄 Gastos PDF</Text>
          </Pressable>
          <Pressable style={[styles.botonAccionSmall, { borderColor: '#DC2626', opacity: exporting ? 0.6 : 1 }]}
            onPress={() => exportToPDF('catalogo', 'Catalogo')} disabled={exporting}>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>📄 Catálogo PDF</Text>
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

      {/* Historial de sincronización */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>📋 Historial de sincronización</Text>
        {syncLog.length === 0 ? (
          <Text style={[styles.cardText, { color: c.textSecondary }]}>No hay registros de sincronización.</Text>
        ) : (
          syncLog.map((entry) => (
            <View key={entry.id} style={[styles.syncCard, { backgroundColor: c.background, borderColor: c.border }]}>
              <Text style={[styles.syncTime, { color: c.text }]}>
                {new Date(entry.timestamp).toLocaleString()}
              </Text>
              <View style={styles.syncCounts}>
                <Text style={[styles.syncCount, { color: c.textSecondary }]}>
                  📊 {entry.ventas} ventas  📉 {entry.gastos} gastos
                </Text>
                <Text style={[styles.syncCount, { color: c.textSecondary }]}>
                  📦 {entry.catalogo} catálogo  🛒 {entry.compras} compras
                </Text>
              </View>
              {entry.error && (
                <Text style={[styles.syncError, { color: c.danger }]}>⚠️ {entry.error}</Text>
              )}
            </View>
          ))
        )}
      </View>

      {/* Versión */}
      <Text style={[styles.version, { color: c.textSecondary }]}>Mi Caja Digital v1.2.0</Text>
    </ScrollView>
  );
}

function TimePicker({ hora, minuto, onChange, colors: c }: {
  hora: number;
  minuto: number;
  onChange: (h: number, m: number) => void;
  colors: Record<string, string>;
}) {
  const horas = Array.from({ length: 24 }, (_, i) => i);
  const minutos = [0, 15, 30, 45];

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.pickerLabel, { color: c.textSecondary }]}>Hora</Text>
      <View style={styles.pickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {horas.map((h) => (
            <Pressable
              key={h}
              onPress={() => onChange(h, minuto)}
              style={[
                styles.pickerBtn,
                {
                  backgroundColor: h === hora ? c.primary : c.background,
                  borderColor: c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pickerBtnText,
                  { color: h === hora ? '#fff' : c.text },
                ]}
              >
                {String(h).padStart(2, '0')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Text style={[styles.pickerLabel, { color: c.textSecondary }]}>Minuto</Text>
      <View style={styles.pickerRow}>
        {minutos.map((m) => (
          <Pressable
            key={m}
            onPress={() => onChange(hora, m)}
            style={[
              styles.pickerBtn,
              {
                backgroundColor: m === minuto ? c.primary : c.background,
                borderColor: c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.pickerBtnText,
                { color: m === minuto ? '#fff' : c.text },
              ]}
            >
              {String(m).padStart(2, '0')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
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
  colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  pickerLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  pickerRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 4,
  },
  pickerBtnText: { fontSize: 14, fontWeight: '600' },
  syncCard: {
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
  },
  syncTime: { fontSize: 13, fontWeight: '700' },
  syncCounts: { marginTop: 4 },
  syncCount: { fontSize: 12, marginVertical: 1 },
  syncError: { fontSize: 12, marginTop: 4, fontWeight: '600' },
});