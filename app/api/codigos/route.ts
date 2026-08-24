import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import precios from '@config/precios.json';
import { registrarAccion } from '@/lib/audit';

const PRECIOS: Record<string, Record<string, number>> = precios.planes;

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para dictar el código por
// teléfono o WhatsApp sin confusiones.
const CHARS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_CODIGO = 8;

// Límite suave en memoria: el panel tiene UN administrador; esto solo corta
// floods accidentales o un script desbocado (no es anti fuerza bruta — eso es
// /api/login con RPC server-side). En serverless la memoria es por instancia,
// suficiente para el propósito.
const creacionesRecientes: number[] = [];
const MAX_CODIGOS_POR_MINUTO = 30;
function excedeLimiteCreacion(): boolean {
  const ahora = Date.now();
  while (
    creacionesRecientes.length &&
    ahora - creacionesRecientes[0] > 60000
  ) {
    creacionesRecientes.shift();
  }
  if (creacionesRecientes.length >= MAX_CODIGOS_POR_MINUTO) return true;
  creacionesRecientes.push(ahora);
  return false;
}

/// Genera un código con CSPRNG (randomInt de node:crypto). Los códigos activan
/// suscripciones pagadas: NO usar Math.random() (predecible).
function generarCodigo(): string {
  let code = '';
  for (let i = 0; i < LARGO_CODIGO; i++) {
    code += CHARS_CODIGO[randomInt(CHARS_CODIGO.length)];
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Paginación server-side: sin esto, cuando haya >100 códigos los viejos
    // desaparecerían silenciosamente del panel. Validación estricta: Number
    // de basura da NaN y NaN atraviesa Math.min/max → range(NaN, NaN) → 500.
    const porPaginaNum = Number(
      request.nextUrl.searchParams.get('porPagina') ?? 50
    );
    const porPagina =
      Number.isFinite(porPaginaNum) && porPaginaNum > 0
        ? Math.min(200, Math.trunc(porPaginaNum))
        : 50;
    const paginaNum = Number(request.nextUrl.searchParams.get('pagina') ?? 1);
    const pagina =
      Number.isInteger(paginaNum) && paginaNum > 0
        ? Math.min(paginaNum, 10_000_000)
        : 1;
    const desde = (pagina - 1) * porPagina;

    const [{ count }, { data, error }] = await Promise.all([
      supabaseAdmin.from('codigos_pago').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('codigos_pago')
        .select('*')
        .order('created_at', { ascending: false })
        .range(desde, desde + porPagina - 1),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const total = count ?? 0;
    return NextResponse.json({
      data: data ?? [],
      pagina,
      porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (excedeLimiteCreacion()) {
      return NextResponse.json(
        { error: 'Demasiados códigos creados seguidos. Espera un minuto.' },
        { status: 429 }
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const { email, plan, duracion_meses, metodo_pago } = (body ?? {}) as Record<
      string,
      unknown
    >;

    if (
      typeof email !== 'string' ||
      typeof plan !== 'string' ||
      typeof duracion_meses !== 'number' ||
      !Number.isInteger(duracion_meses) ||
      (metodo_pago !== undefined && typeof metodo_pago !== 'string')
    ) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }
    if (!PRECIOS[plan] || !PRECIOS[plan][String(duracion_meses)]) {
      return NextResponse.json(
        { error: 'Plan o duración no válido' },
        { status: 400 }
      );
    }

    // El email debe existir en negocios para que la clienta pueda canjearlo.
    const { data: negocio } = await supabaseAdmin
      .from('negocios')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (!negocio) {
      return NextResponse.json(
        {
          error:
            'No existe ninguna cuenta con ese correo. La clienta debe crear su cuenta primero antes de pagar.',
        },
        { status: 400 }
      );
    }

    const precio = PRECIOS[plan][String(duracion_meses)];
    // El código es válido por 30 días para canjearse. La suscripción que activa
    // se calcula al canjear a partir de duracion_meses (función canjear_codigo).
    const validez = new Date();
    validez.setUTCDate(validez.getUTCDate() + 30);

    // Unicidad garantizada por la constraint UNIQUE(codigo) de la DB: se
    // intenta insertar y, si choca (23505 unique_violation), se regenera.
    // Sin pre-consultas y sin carrera posible entre dos inserts simultáneos.
    const emailNormalizado = email.trim().toLowerCase();
    let ultimoError: string | null = null;
    for (let intento = 0; intento < 5; intento++) {
      const { data, error } = await supabaseAdmin
        .from('codigos_pago')
        .insert({
          codigo: generarCodigo(),
          email: emailNormalizado,
          plan,
          duracion_meses,
          precio_pagado: precio,
          metodo_pago: metodo_pago || 'efectivo',
          fecha_expiracion: validez.toISOString(),
          usado: false,
        })
        .select()
        .single();

      if (!error) {
        await registrarAccion('codigo_creado', 'codigo_pago', String(data.id), {
          codigo: data.codigo,
          email: emailNormalizado,
          plan,
          duracion_meses,
          precio_pagado: precio,
          metodo_pago: data.metodo_pago,
        });
        return NextResponse.json({ data });
      }
      if (error.code !== '23505') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      ultimoError = error.message;
    }
    // Prácticamente imposible (32^8 combinaciones), pero respondemos honesto.
    return NextResponse.json(
      { error: `No se pudo generar un código único. ${ultimoError ?? ''}` },
      { status: 500 }
    );
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
