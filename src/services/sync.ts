import { type SQLiteDatabase } from 'expo-sqlite';
import { supabase } from './supabase';

export async function syncToSupabase(db: SQLiteDatabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ventas: 0, gastos: 0 };

  const userId = user.id;
  let ventasCount = 0;
  let gastosCount = 0;

  const unsyncedVentas = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ventas WHERE sincronizado = 0 AND user_id = ?',
    [userId]
  );

  for (const v of unsyncedVentas) {
    const { error } = await supabase.from('ventas').upsert(
      {
        id: v.id,
        user_id: v.user_id,
        producto: v.producto,
        precio: v.precio,
        cliente: v.cliente,
        tipo: v.tipo,
        pagado: v.pagado,
        fecha: v.fecha,
        created_at: v.created_at,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('Error syncing venta:', error.message);
    } else {
      await db.runAsync('UPDATE ventas SET sincronizado = 1 WHERE id = ?', [v.id]);
      ventasCount++;
    }
  }

  const unsyncedGastos = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM gastos WHERE sincronizado = 0 AND user_id = ?',
    [userId]
  );

  for (const g of unsyncedGastos) {
    const { error } = await supabase.from('gastos').upsert(
      {
        id: g.id,
        user_id: g.user_id,
        concepto: g.concepto,
        monto: g.monto,
        fecha: g.fecha,
        created_at: g.created_at,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('Error syncing gasto:', error.message);
    } else {
      await db.runAsync('UPDATE gastos SET sincronizado = 1 WHERE id = ?', [g.id]);
      gastosCount++;
    }
  }

  return { ventas: ventasCount, gastos: gastosCount };
}
