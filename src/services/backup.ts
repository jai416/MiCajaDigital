import { type SQLiteDatabase } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/src/services/supabase';

export const BACKUP_TASK_NAME = 'auto-backup';

const TABLAS = ['ventas', 'gastos', 'catalogo', 'compras'] as const;

function escapeCSV(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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

export async function hacerBackup(db: SQLiteDatabase, userId: string): Promise<boolean> {
  try {
    const dir = FileSystem.documentDirectory + 'backups/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const fecha = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const tabla of TABLAS) {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${tabla} WHERE user_id = ?`, [userId]
      );
      if (rows.length === 0) continue;
      const csv = rowsToCSV(rows);
      const uri = dir + `${tabla}_${fecha}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      count++;
    }
    return count > 0;
  } catch {
    return false;
  }
}

TaskManager.defineTask(BACKUP_TASK_NAME, async () => {
  try {
    const db = await getDb();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return BackgroundTask.BackgroundTaskResult.Failed;
    await hacerBackup(db, user.id);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function getDb(): Promise<SQLiteDatabase> {
  const { openDatabaseAsync } = await import('expo-sqlite');
  return openDatabaseAsync('micajadigital.db');
}

export async function registrarBackupAutomatico(intervaloMin: number): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(BACKUP_TASK_NAME, {
      minimumInterval: intervaloMin * 60,
    });
  } catch { /* tarea ya registrada o no soportada */ }
}

export async function desregistrarBackupAutomatico(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKUP_TASK_NAME);
  } catch { /* silencioso */ }
}

export async function estadoBackupAutomatico(): Promise<boolean> {
  try {
    const tasks = await TaskManager.getRegisteredTasksAsync();
    return tasks.some(t => t.taskName === BACKUP_TASK_NAME);
  } catch {
    return false;
  }
}
