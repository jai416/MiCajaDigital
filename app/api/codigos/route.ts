import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import precios from '@config/precios.json';

const PRECIOS: Record<string, Record<string, number>> = precios.planes;

function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { data, error } = await supabaseAdmin
      .from('codigos_pago')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await request.json();
    const { email, plan, duracion_meses, metodo_pago } = body;

    if (!email || !plan || !duracion_meses) {
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

    // Reservar un código único sin colisiones
    let codigo = generarCodigo();
    let conflict = true;
    while (conflict) {
      const { data } = await supabaseAdmin
        .from('codigos_pago')
        .select('id')
        .eq('codigo', codigo)
        .maybeSingle();
      if (!data) conflict = false;
      else codigo = generarCodigo();
    }

    const { data, error } = await supabaseAdmin.from('codigos_pago').insert({
      codigo,
      email: email.trim().toLowerCase(),
      plan,
      duracion_meses,
      precio_pagado: precio,
      metodo_pago: metodo_pago || 'efectivo',
      fecha_expiracion: validez.toISOString(),
      usado: false,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}