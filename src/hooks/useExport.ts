import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { registrarEvento } from '@/src/services/analytics';

const TABLAS_PERMITIDAS = ['ventas', 'gastos', 'catalogo', 'compras', 'app_config'] as const;
type TablaPermitida = typeof TABLAS_PERMITIDAS[number];

function escapeCSV(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeHTML(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rowsToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCSV).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCSV(row[h])).join(','));
  }
  return lines.join('\n');
}

export function useExport() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const lastExportRef = useRef(0);
  const EXPORT_COOLDOWN = 5000;
  const [exporting, setExporting] = useState(false);

  const exportTable = useCallback(async (table: string, nombre: string) => {
    if (Date.now() - lastExportRef.current < EXPORT_COOLDOWN) { Alert.alert('Espera', 'Ya exportaste hace unos segundos. Espera un momento.'); return; }
    if (!TABLAS_PERMITIDAS.includes(table as TablaPermitida)) {
      Alert.alert('Error', 'Tabla no válida.'); return;
    }
    setExporting(true);
    try {
      const userId = user?.id;
      if (!userId) { Alert.alert('Sin sesión', 'Debes iniciar sesión.'); return; }
      const where = table === 'app_config' ? '' : ' WHERE user_id = ?';
      const params = table === 'app_config' ? [] : [userId];
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${table}${where} ORDER BY created_at DESC`, params
      );

      if (rows.length === 0) { Alert.alert('Sin datos', `No hay registros en "${nombre}".`); return; }

      const csv = rowsToCSV(rows);
      const filename = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
      } else {
        Alert.alert('Exportado', `Archivo guardado en: ${fileUri}`);
      }
      lastExportRef.current = Date.now();
      if (userId) registrarEvento(db, userId, { nombre: 'export_csv', valor: nombre });
    } catch (e) {
      Alert.alert('Error', 'No se pudo exportar: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setExporting(false);
    }
  }, [db, user]);

  const exportTodo = useCallback(async () => {
    if (Date.now() - lastExportRef.current < EXPORT_COOLDOWN) { Alert.alert('Espera', 'Ya exportaste hace unos segundos. Espera un momento.'); return; }
    setExporting(true);
    try {
      const userId = user?.id;
      if (!userId) { Alert.alert('Sin sesión', 'Debes iniciar sesión.'); return; }

      const tablas: [string, string][] = [
        ['ventas', 'Ventas'],
        ['gastos', 'Gastos'],
        ['catalogo', 'Catalogo'],
      ];
      const fecha = new Date().toISOString().slice(0, 10);

      let firstUri = '';
      let count = 0;
      for (const [table, nombre] of tablas) {
        const rows = await db.getAllAsync<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`, [userId]
        );
        if (rows.length === 0) continue;
        const csv = rowsToCSV(rows);
        const filename = `${nombre}_${fecha}.csv`;
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        count++;
        if (!firstUri) firstUri = fileUri;
      }

      if (count === 0) {
        Alert.alert('Exportado', 'No hay datos para exportar.');
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(firstUri, { mimeType: 'text/csv' });
        Alert.alert('Exportado', `Se exportaron ${count} archivo(s). El primero fue compartido, los demás están en la carpeta de la app.`);
      } else {
        Alert.alert('Exportado', `${count} archivo(s) guardados en la carpeta de la app.`);
      }
      lastExportRef.current = Date.now();
    } catch (e) {
      Alert.alert('Error', (e instanceof Error ? e.message : ''));
    } finally {
      setExporting(false);
    }
  }, [db, user]);

  const exportToPDF = useCallback(async (table: string, nombre: string) => {
    if (Date.now() - lastExportRef.current < EXPORT_COOLDOWN) {
      Alert.alert('Espera', 'Ya exportaste hace unos segundos. Espera un momento.');
      return;
    }
    if (!TABLAS_PERMITIDAS.includes(table as TablaPermitida)) {
      Alert.alert('Error', 'Tabla no válida.');
      return;
    }
    if (table === 'app_config') {
      Alert.alert('No disponible', 'La configuración no se exporta en PDF.');
      return;
    }
    setExporting(true);
    try {
      const userId = user?.id;
      if (!userId) { Alert.alert('Sin sesión', 'Debes iniciar sesión.'); return; }

      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`, [userId]
      );
      if (rows.length === 0) { Alert.alert('Sin datos', `No hay registros en "${nombre}".`); return; }

      const headers = Object.keys(rows[0]);
      const html = `
<html><head><meta charset="utf-8">
<style>
  body { font-family: sans-serif; padding: 20px; }
  h2 { color: #16A34A; text-align: center; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #16A34A; color: white; font-weight: 700; }
  tr:nth-child(even) { background: #f9f9f9; }
</style></head><body>
<h2>${escapeHTML(nombre)}</h2>
<table><thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${escapeHTML(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>
</table></body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      lastExportRef.current = Date.now();
      if (userId) registrarEvento(db, userId, { nombre: 'export_pdf', valor: nombre });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert('Exportado', `PDF guardado en: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al exportar PDF');
    } finally {
      setExporting(false);
    }
  }, [db, user]);

  return { exportTable, exportTodo, exportToPDF, exporting };
}
