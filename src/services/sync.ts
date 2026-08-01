import { type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { generarUUID } from '@/src/utils/uuid';
import { logError } from '@/src/services/logger';

type SQLiteRow = Record<string, string | number | null | boolean | Uint8Array>;

async function compressImage(uri: string, maxWidth: number): Promise<string> {
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], { compress: 0.7, format: SaveFormat.JPEG });
    return result.uri;
  } catch {
    return uri;
  }
}

async function uploadPhotoToStorage(uri: string, userId: string, prefix: string, maxWidth = 1024): Promise<string> {
  if (!uri || uri.startsWith('http')) return uri;
  try {
    const compressedUri = await compressImage(uri, maxWidth);
    const base64 = await FileSystem.readAsStringAsync(compressedUri, { encoding: FileSystem.EncodingType.Base64 });
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${prefix}/${userId}/${Date.now()}.${ext}`;
    const { data } = await supabase.storage.from('fotos').upload(fileName, decodeBase64(base64), {
      contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
      upsert: true,
    });
    if (data) {
      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(data.path);
      return urlData.publicUrl;
    }
  } catch { /* si falla la subida, se queda la URI local */ }
  return uri;
}

function decodeBase64(str: string): Uint8Array {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function esMasNuevo(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

async function getLastSync(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ valor: string }>(
    "SELECT valor FROM app_config WHERE clave = 'last_sync_at'"
  );
  return row?.valor ?? '2000-01-01T00:00:00.000Z';
}

async function setLastSync(db: SQLiteDatabase, ts: string) {
  await db.runAsync(
    "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('last_sync_at', ?)",
    [ts]
  );
}

export async function syncToSupabase(db: SQLiteDatabase) {
  const syncStart = new Date().toISOString();
  let userId = '';
  let ventasCount = 0;
  let gastosCount = 0;
  let catalogoCount = 0;
  let comprasCount = 0;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ventas: 0, gastos: 0, catalogo: 0, compras: 0 };
    userId = user.id;

  // ---- PUSH: local → cloud ----
  const unsyncedVentas = await db.getAllAsync<SQLiteRow>(
    'SELECT * FROM ventas WHERE (sincronizado = 0 OR deleted_at IS NOT NULL) AND user_id = ?',
    [userId]
  );

  for (const v of unsyncedVentas) {
    if (v.deleted_at) {
      const { error } = await supabase.from('ventas').delete().eq('id', v.id);
      if (!error) {
        await db.runAsync('UPDATE ventas SET sincronizado = 1, updated_at = ? WHERE id = ?', [syncStart, v.id]);
        ventasCount++;
      }
      continue;
    }
      const { error } = await supabase.from('ventas').upsert(
        {
          id: v.id,
          user_id: v.user_id,
          producto: v.producto,
          precio: v.precio,
          costo: v.costo ?? 0,
          cliente: v.cliente,
          tipo: v.tipo_pedido ?? v.tipo ?? 'contado',
          pagado: v.pagado,
          fecha: v.fecha,
          created_at: v.created_at,
          updated_at: syncStart,
          catalogo_id: v.catalogo_id ?? null,
          metodo_pago: v.metodo_pago ?? 'efectivo',
          moneda: v.moneda ?? 'CUP',
          tipo_pedido: v.tipo_pedido ?? v.tipo ?? 'contado',
          anticipo: v.anticipo ?? 0,
          saldo_pendiente: v.saldo_pendiente ?? 0,
          fecha_entrega: v.fecha_entrega ?? null,
          estado_pedido: v.estado_pedido ?? 'pendiente',
          nota: v.nota ?? '',
          deleted_at: v.deleted_at ?? null,
        },
        { onConflict: 'id' }
      );
    if (error) {
      /* error silencioso */
    } else {
      await db.runAsync(
        'UPDATE ventas SET sincronizado = 1, updated_at = ? WHERE id = ?',
        [syncStart, v.id]
      );
      ventasCount++;
    }
  }

  const unsyncedGastos = await db.getAllAsync<SQLiteRow>(
    'SELECT * FROM gastos WHERE sincronizado = 0 AND user_id = ?',
    [userId]
  );

  for (const g of unsyncedGastos) {
    let fotoUrl = g.foto ?? '';
    if (typeof g.foto === 'string' && g.foto && !g.foto.startsWith('http')) {
      const subida = await uploadPhotoToStorage(g.foto, userId, 'gastos');
      if (subida === g.foto) {
        continue;
      }
      fotoUrl = subida;
    }
    const { error } = await supabase.from('gastos').upsert(
      {
        id: g.id,
        user_id: g.user_id,
        concepto: g.concepto,
        monto: g.monto,
        fecha: g.fecha,
        foto: fotoUrl,
        created_at: g.created_at,
        updated_at: syncStart,
      },
      { onConflict: 'id' }
    );
    if (!error) {
      await db.runAsync('UPDATE gastos SET foto = ?, sincronizado = 1, updated_at = ? WHERE id = ?', [fotoUrl, syncStart, g.id]);
      gastosCount++;
    }
  }

  // ---- PULL: cloud → local ----
  const oldLastSync = await getLastSync(db);

  const { data: remoteVentas, error: pullErrVentas } = await supabase
    .from('ventas')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', oldLastSync);

  if (pullErrVentas) throw new Error(`Error PULL ventas: ${pullErrVentas.message}`);
  if (remoteVentas) {
    for (const rv of remoteVentas) {
      const local = await db.getFirstAsync<{ updated_at: string }>(
        'SELECT updated_at FROM ventas WHERE id = ?', [rv.id]
      );

      const remoteUpdated = rv.updated_at ?? '2000-01-01T00:00:00.000Z';
      const localUpdated = local?.updated_at ?? '2000-01-01T00:00:00.000Z';
      const tipoPedido = rv.tipo_pedido ?? rv.tipo ?? 'contado';

      if (rv.deleted_at) {
        if (local && !localUpdated.startsWith('2000')) {
          await db.runAsync(
            'UPDATE ventas SET deleted_at = ?, sincronizado = 1, updated_at = ? WHERE id = ?',
            [rv.deleted_at, remoteUpdated, rv.id]
          );
          ventasCount++;
        }
        continue;
      }
      if (!local) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ventas
           (id, user_id, producto, precio, costo, cliente, tipo, moneda, tipo_pedido, pagado, fecha,
             catalogo_id, metodo_pago, anticipo, saldo_pendiente, fecha_entrega, estado_pedido, nota,
             deleted_at, sincronizado, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [rv.id, rv.user_id, rv.producto, rv.precio, rv.costo ?? 0, rv.cliente ?? '',
           tipoPedido, rv.moneda ?? 'CUP', tipoPedido,
           rv.pagado ?? 1, rv.fecha, rv.catalogo_id ?? null, rv.metodo_pago ?? 'efectivo',
            rv.anticipo ?? 0, rv.saldo_pendiente ?? 0, rv.fecha_entrega ?? null, rv.estado_pedido ?? 'pendiente',
            rv.nota ?? '',
            rv.deleted_at ?? null,
            rv.created_at ?? remoteUpdated, remoteUpdated]
        );
        ventasCount++;
      } else if (esMasNuevo(remoteUpdated, localUpdated)) {
        await db.runAsync(
          `UPDATE ventas SET producto=?, precio=?, costo=?, cliente=?, tipo=?, moneda=?, tipo_pedido=?, pagado=?, fecha=?,
           catalogo_id=?, metodo_pago=?, anticipo=?, saldo_pendiente=?, fecha_entrega=?, estado_pedido=?, nota=?,
           deleted_at=?, sincronizado=1, updated_at=? WHERE id=?`,
          [rv.producto, rv.precio, rv.costo ?? 0, rv.cliente ?? '',
           tipoPedido, rv.moneda ?? 'CUP', tipoPedido,
           rv.pagado ?? 1, rv.fecha, rv.catalogo_id ?? null, rv.metodo_pago ?? 'efectivo',
           rv.anticipo ?? 0, rv.saldo_pendiente ?? 0, rv.fecha_entrega ?? null, rv.estado_pedido ?? 'pendiente',
           rv.nota ?? '',
           rv.deleted_at ?? null,
           remoteUpdated, rv.id]
        );
        ventasCount++;
      }
    }
  }

  const { data: remoteGastos, error: pullErrGastos } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', oldLastSync);

  if (pullErrGastos) throw new Error(`Error PULL gastos: ${pullErrGastos.message}`);
  if (remoteGastos) {
    for (const rg of remoteGastos) {
      const local = await db.getFirstAsync<{ updated_at: string }>(
        'SELECT updated_at FROM gastos WHERE id = ?', [rg.id]
      );

      const remoteUpdated = rg.updated_at ?? '2000-01-01T00:00:00.000Z';
      const localUpdated = local?.updated_at ?? '2000-01-01T00:00:00.000Z';

      if (!local) {
        await db.runAsync(
          `INSERT OR REPLACE INTO gastos
           (id, user_id, concepto, monto, fecha, foto, sincronizado, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [rg.id, rg.user_id, rg.concepto, rg.monto, rg.fecha, rg.foto ?? '',
           rg.created_at ?? remoteUpdated, remoteUpdated]
        );
        gastosCount++;
      } else if (esMasNuevo(remoteUpdated, localUpdated)) {
        await db.runAsync(
          `UPDATE gastos SET concepto=?, monto=?, fecha=?, foto=?, sincronizado=1, updated_at=? WHERE id=?`,
          [rg.concepto, rg.monto, rg.fecha, rg.foto ?? '', remoteUpdated, rg.id]
        );
        gastosCount++;
      }
    }
  }

  // ---- PUSH: catalogo local → cloud ----
  const unsyncedCatalogo = await db.getAllAsync<SQLiteRow>(
    'SELECT * FROM catalogo WHERE (sincronizado = 0 OR deleted_at IS NOT NULL) AND user_id = ?',
    [userId]
  );

  for (const c of unsyncedCatalogo) {
    if (c.deleted_at) {
      const { error } = await supabase.from('catalogo').delete().eq('id', c.id);
      if (!error) {
        await db.runAsync('UPDATE catalogo SET sincronizado = 1, updated_at = ? WHERE id = ?', [syncStart, c.id]);
        catalogoCount++;
      }
      continue;
    }
    let fotoUrl = c.foto ?? '';
    if (typeof c.foto === 'string' && c.foto && !c.foto.startsWith('http')) {
      const subida = await uploadPhotoToStorage(c.foto, userId, 'catalogo', 200);
      if (subida === c.foto) {
        continue;
      }
      fotoUrl = subida;
    }
    const { error } = await supabase.from('catalogo').upsert(
      {
        id: c.id,
        user_id: c.user_id,
        nombre: c.nombre,
        precio: c.precio,
        stock: c.stock,
        descripcion: c.descripcion ?? '',
        codigo_barras: c.codigo_barras ?? '',
        categoria: c.categoria ?? '',
        foto: fotoUrl,
        created_at: c.created_at,
        updated_at: syncStart,
        deleted_at: c.deleted_at ?? null,
      },
      { onConflict: 'id' }
    );
    if (error) {
      /* error pushing catalogo */
    } else {
      await db.runAsync(
        'UPDATE catalogo SET foto = ?, sincronizado = 1, updated_at = ? WHERE id = ?',
        [fotoUrl, syncStart, c.id]
      );
      catalogoCount++;
    }
  }

  // ---- PULL: catalogo cloud → local ----
  const { data: remoteCatalogo, error: pullErrCatalogo } = await supabase
    .from('catalogo')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', oldLastSync);

  if (pullErrCatalogo) throw new Error(`Error PULL catalogo: ${pullErrCatalogo.message}`);
  if (remoteCatalogo) {
    for (const rc of remoteCatalogo) {
      const local = await db.getFirstAsync<{ updated_at: string }>(
        'SELECT updated_at FROM catalogo WHERE id = ?', [rc.id]
      );

      const remoteUpdated = rc.updated_at ?? '2000-01-01T00:00:00.000Z';
      const localUpdated = local?.updated_at ?? '2000-01-01T00:00:00.000Z';

      if (rc.deleted_at) {
        if (local && !localUpdated.startsWith('2000')) {
          await db.runAsync(
            'UPDATE catalogo SET deleted_at = ?, sincronizado = 1, updated_at = ? WHERE id = ?',
            [rc.deleted_at, remoteUpdated, rc.id]
          );
          catalogoCount++;
        }
        continue;
      }
      if (!local) {
        await db.runAsync(
          `INSERT OR REPLACE INTO catalogo
           (id, user_id, nombre, precio, stock, descripcion, codigo_barras, categoria, foto, sincronizado, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [rc.id, rc.user_id, rc.nombre, rc.precio, rc.stock ?? 0, rc.descripcion ?? '', rc.codigo_barras ?? '', rc.categoria ?? '', rc.foto ?? '',
           rc.created_at ?? remoteUpdated, remoteUpdated, rc.deleted_at ?? null]
        );
        catalogoCount++;
      } else if (esMasNuevo(remoteUpdated, localUpdated)) {
        await db.runAsync(
          `UPDATE catalogo SET nombre=?, precio=?, stock=?, descripcion=?, codigo_barras=?, categoria=?, foto=?, deleted_at=?, sincronizado=1, updated_at=? WHERE id=?`,
          [rc.nombre, rc.precio, rc.stock ?? 0, rc.descripcion ?? '', rc.codigo_barras ?? '', rc.categoria ?? '', rc.foto ?? '', rc.deleted_at ?? null, remoteUpdated, rc.id]
        );
        catalogoCount++;
      }
    }
  }

  // ---- PUSH: compras local → cloud ----
  const unsyncedCompras = await db.getAllAsync<SQLiteRow>(
    'SELECT * FROM compras WHERE (sincronizado = 0 OR deleted_at IS NOT NULL) AND user_id = ?', [userId]
  );
  for (const c of unsyncedCompras) {
    if (c.deleted_at) {
      const { error } = await supabase.from('compras').delete().eq('id', c.id);
      if (!error) {
        await db.runAsync('UPDATE compras SET sincronizado = 1, updated_at = ? WHERE id = ?', [syncStart, c.id]);
        comprasCount++;
      }
      continue;
    }
    const { error } = await supabase.from('compras').upsert({
      id: c.id, user_id: c.user_id, producto: c.producto,
      costo_unitario: c.costo_unitario, cantidad: c.cantidad,
      costo_total: c.costo_total, proveedor: c.proveedor ?? '',
      fecha: c.fecha, created_at: c.created_at, updated_at: syncStart,
      deleted_at: c.deleted_at ?? null,
    }, { onConflict: 'id' });
    if (!error) {
      await db.runAsync('UPDATE compras SET sincronizado = 1, updated_at = ? WHERE id = ?', [syncStart, c.id]);
      comprasCount++;
    }
  }

  // ---- PULL: compras cloud → local ----
  const { data: remoteCompras, error: pullErrCompras } = await supabase
    .from('compras').select('*').eq('user_id', userId).gt('updated_at', oldLastSync);
  if (pullErrCompras) throw new Error(`Error PULL compras: ${pullErrCompras.message}`);
  if (remoteCompras) {
    for (const rc of remoteCompras) {
      const local = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM compras WHERE id = ?', [rc.id]);
      const remoteUpdated = rc.updated_at ?? '2000-01-01T00:00:00.000Z';
      const localUpdated = local?.updated_at ?? '2000-01-01T00:00:00.000Z';
      if (rc.deleted_at) {
        if (local && !localUpdated.startsWith('2000')) {
          await db.runAsync(
            'UPDATE compras SET deleted_at = ?, sincronizado = 1, updated_at = ? WHERE id = ?',
            [rc.deleted_at, remoteUpdated, rc.id]
          );
          comprasCount++;
        }
        continue;
      }
      if (!local) {
        await db.runAsync(
          `INSERT OR REPLACE INTO compras
           (id, user_id, producto, costo_unitario, cantidad, costo_total, proveedor, fecha, sincronizado, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [rc.id, rc.user_id, rc.producto, rc.costo_unitario, rc.cantidad, rc.costo_total, rc.proveedor ?? '', rc.fecha,
           rc.created_at ?? remoteUpdated, remoteUpdated, rc.deleted_at ?? null]
        );
        comprasCount++;
      } else if (esMasNuevo(remoteUpdated, localUpdated)) {
        await db.runAsync(
          `UPDATE compras SET producto=?, costo_unitario=?, cantidad=?, costo_total=?, proveedor=?, fecha=?, deleted_at=?, sincronizado=1, updated_at=? WHERE id=?`,
          [rc.producto, rc.costo_unitario, rc.cantidad, rc.costo_total, rc.proveedor ?? '', rc.fecha, rc.deleted_at ?? null, remoteUpdated, rc.id]
        );
        comprasCount++;
      }
    }
  }

  await setLastSync(db, syncStart);

  try {
    await db.runAsync(
      'INSERT INTO sync_log (id, user_id, timestamp, ventas, gastos, catalogo, compras, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [generarUUID(), userId, syncStart, ventasCount, gastosCount, catalogoCount, comprasCount, null]
    );
    } catch { /* si falla el log no detiene el sync */ }

  return { ventas: ventasCount, gastos: gastosCount, catalogo: catalogoCount, compras: comprasCount };
  } catch (e) {
    await logError('sync', e, `userId=${userId}`);
    try {
      await db.runAsync(
        'INSERT INTO sync_log (id, user_id, timestamp, ventas, gastos, catalogo, compras, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [generarUUID(), userId, syncStart, 0, 0, 0, 0, e instanceof Error ? e.message : 'Unknown error']
      );
    } catch { /* silencioso */ }
    return { ventas: 0, gastos: 0, catalogo: 0, compras: 0 };
  }
}
