import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { registrarAccion } from '@/lib/audit';

export async function PATCH(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Allowlist: solo campos administrativos. NUNCA aceptar columnas del body
    // a ciegas (mass assignment): un PATCH malicioso podría reescribir email,
    // user_id, updated_at, etc.
    const permitidos = [
      'activo',
      'plan',
      'fecha_expiracion',
      'nombre_negocio',
      'telefono',
      'deleted_at',
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const campo of permitidos) {
      if (body[campo] !== undefined) updates[campo] = body[campo];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin campos válidos para actualizar' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('negocios').update(updates).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await registrarAccion('negocio_actualizado', 'negocio', String(id), {
      campos: Object.keys(updates),
      updates,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id, permanente } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Por defecto es soft-delete (papelera): marca deleted_at en vez de borrar
    // la fila. El borrado físico destruiría los datos del negocio por la FK
    // CASCADE de ventas/gastos/catálogo. La restauración vuelve a poner
    // deleted_at = null.
    if (permanente === true) {
      const { error } = await supabaseAdmin
        .from('negocios')
        .delete()
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await registrarAccion('negocio_eliminado_permanente', 'negocio', String(id), {});
      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from('negocios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await registrarAccion('negocio_a_papelera', 'negocio', String(id), {});
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
