import { supabaseAdmin } from '@/lib/supabase';
import { requireSession } from '@/lib/auth';
import precios from '@config/precios.json';

export const dynamic = 'force-dynamic';

// Fuente de verdad de precios: config/precios.json (raíz del repo). La app lo
// valida en test/suscripcion_test.dart contra sus PLANES.
const PRECIOS_PLAN: Record<string, number> = Object.fromEntries(
  Object.entries(precios.planes).map(([id, p]) => [id, p['1']]),
);

const RANGOS = [7, 15, 30, 90] as const;

interface SearchParams {
  rango?: string;
}

const MS_DIA = 86400000;
// TC por defecto = los mismos que usa la app (defaults de app_config).
const TC_DEFAULT = 340;

function deltaPct(actual: number, previo: number): number | null {
  if (previo <= 0) return actual > 0 ? null : 0;
  return Math.round(((actual - previo) / previo) * 100);
}

interface NegRow {
  id: string;
  activo: boolean | null;
  plan: string | null;
  fecha_registro: string | null;
  fecha_expiracion: string | null;
  deleted_at: string | null;
  nombre_negocio?: string | null;
  email?: string | null;
  tc_usd?: number | null;
  tc_mlc?: number | null;
}

async function getStats(dias: number) {
  const ahora = Date.now();
  const hoyStr = new Date(ahora).toISOString().slice(0, 10);
  const desde = new Date(ahora - (dias - 1) * MS_DIA).toISOString().slice(0, 10);
  const hace6mIso = new Date(ahora - 183 * MS_DIA).toISOString();
  // Códigos sin canjear que ya expiraron (ventas perdidas a recontactar).
  const ahoraIso = new Date(ahora).toISOString();
  const enTresDiasIso = new Date(ahora + 3 * MS_DIA).toISOString();

  // ---- RPC stats_dashboard_resumen: todos los conteos simples en 1 query ----
  const fallos: string[] = [];
  const notaFallo = (nombre: string, r: { error: { message: string } | null }) => {
    if (r.error) fallos.push(nombre);
  };
  const { data: rpcData, error: rpcError } = await supabaseAdmin
    .rpc('stats_dashboard_resumen')
    .single();

  let rpc: Record<string, number> = {};
  if (rpcError || !rpcData) {
    fallos.push('stats_dashboard_resumen (RPC)');
  } else {
    rpc = rpcData as Record<string, number>;
  }

  // ---- Tanda 1 paralela: datos detallados que la RPC no cubre ----
  const [
    rNegocios,
    rCodigosPorVencer,
    rCodigosVencidos,
    rIngresosReales,
    rCodigosConNegocio,
  ] = await Promise.all([
    supabaseAdmin
      .from('negocios')
      .select(
        'id, activo, plan, fecha_registro, fecha_expiracion, deleted_at, tc_usd, tc_mlc, nombre_negocio, email'
      )
      .limit(50000),
    supabaseAdmin
      .from('codigos_pago')
      .select('*', { count: 'exact', head: true })
      .eq('usado', false)
      .lte('fecha_expiracion', enTresDiasIso)
      .gte('fecha_expiracion', ahoraIso),
    supabaseAdmin
      .from('codigos_pago')
      .select('*', { count: 'exact', head: true })
      .eq('usado', false)
      .lt('fecha_expiracion', ahoraIso),
    supabaseAdmin
      .from('codigos_pago')
      .select('precio_pagado, metodo_pago, duracion_meses, negocio_id, usado_en')
      .eq('usado', true)
      .limit(50000),
    supabaseAdmin
      .from('codigos_pago')
      .select('negocio_id')
      .eq('usado', true)
      .not('negocio_id', 'is', null)
      .limit(50000),
  ]);

  notaFallo('negocios', rNegocios);
  notaFallo('códigos por vencer', rCodigosPorVencer);
  notaFallo('códigos vencidos', rCodigosVencidos);
  notaFallo('ingresos reales', rIngresosReales);

  let negociosData: NegRow[] | null = rNegocios.data;
  if (rNegocios.error || negociosData?.[0]?.tc_usd === undefined) {
    const retry = await supabaseAdmin
      .from('negocios')
      .select('id, activo, plan, fecha_registro, fecha_expiracion, deleted_at, nombre_negocio, email');
    if (!retry.error) negociosData = (retry.data as unknown as NegRow[]) ?? [];
  }
  const negocios: NegRow[] = negociosData ?? [];

  const tcPorNegocio = new Map<string, { usd: number; mlc: number }>();
  for (const n of negocios) {
    tcPorNegocio.set(String(n.id), {
      usd: Number(n.tc_usd) > 0 ? Number(n.tc_usd) : TC_DEFAULT,
      mlc: Number(n.tc_mlc) > 0 ? Number(n.tc_mlc) : TC_DEFAULT,
    });
  }
  const tcDe = (userId: string) =>
    tcPorNegocio.get(userId) ?? { usd: TC_DEFAULT, mlc: TC_DEFAULT };

  const codigosGenerados = rCodigosPorVencer.count ?? 0;
  const codigosUsados = 0;
  const codigosPorVencer = rCodigosPorVencer.count ?? 0;
  const codigosVencidosSinUsar = rCodigosVencidos.count ?? 0;
  const ingresosReales = rIngresosReales.data ?? [];
  const codigosConNegocio = rCodigosConNegocio.data ?? [];

  // ---- Tanda 2 paralela: datos detallados para gráficos/LTV ----
  const [
    rVentasRango,
    rGastosRango,
    rVentasDetalle,
    rCodigosGenerados,
    rCodigosUsados,
    rIngresosMeses,
  ] = await Promise.all([
    supabaseAdmin
      .from('ventas')
      .select('*', { count: 'exact', head: true })
      .eq('devuelto', 0)
      .is('deleted_at', null)
      .gte('fecha', desde),
    supabaseAdmin
      .from('gastos')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('fecha', desde),
    supabaseAdmin
      .from('ventas')
      .select('fecha, moneda, precio, descuento, user_id')
      .eq('devuelto', 0)
      .is('deleted_at', null)
      .gte('fecha', desde)
      .limit(50000),
    supabaseAdmin.from('codigos_pago').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('codigos_pago')
      .select('*', { count: 'exact', head: true })
      .eq('usado', true),
    supabaseAdmin
      .from('codigos_pago')
      .select('precio_pagado, usado_en')
      .eq('usado', true)
      .gte('usado_en', hace6mIso)
      .limit(50000),
  ]);

  notaFallo('ventas del rango', rVentasRango);
  notaFallo('gastos del rango', rGastosRango);
  notaFallo('detalle de ventas', rVentasDetalle);
  notaFallo('ingresos por mes', rIngresosMeses);

  const codigosGeneradosFinal = rCodigosGenerados.count ?? 0;
  const codigosUsadosFinal = rCodigosUsados.count ?? 0;
  const ventasRango = rVentasRango.count ?? 0;
  const gastosRango = rGastosRango.count ?? 0;
  const ventasRangoPrev = 0;
  const gastosRangoPrev = 0;
  const errores7 = rpc.logs_errores_7d ?? 0;

  // ---- Negocios: estados corregidos ----
  const vivos = negocios.filter((n) => !n.deleted_at);
  const enPapelera = negocios.length - vivos.length;

  interface RowNeg {
    id: string;
    activo: boolean;
    plan: string;
    registro: number;
    expiracion: number;
  }
  const rows: RowNeg[] = vivos.map((n) => ({
    id: String(n.id),
    activo: !!n.activo,
    plan: (n.plan as string) ?? 'gratis',
    registro: n.fecha_registro ? new Date(n.fecha_registro).getTime() : 0,
    expiracion: n.fecha_expiracion ? new Date(n.fecha_expiracion).getTime() : 0,
  }));

  const total = rows.length;
  // Corrección clave: "activo" solo cuenta si la suscripción sigue vigente.
  // Las vencidas-no-desactivadas son COBRO PENDIENTE, no ingreso.
  const vigentes = rows.filter((n) => n.activo && n.expiracion > ahora);
  const vencidasSinRenovar = rows.filter(
    (n) => n.activo && n.expiracion > 0 && n.expiracion <= ahora
  );
  const activos = vigentes.length;
  const enPrueba = rows.filter(
    (n) => !n.activo && n.registro >= ahora - 15 * MS_DIA
  ).length;
  const expiradasSinActivar = rows.filter(
    (n) => !n.activo && n.registro < ahora - 15 * MS_DIA
  ).length;
  // Pruebas que terminan en ≤3 días (para la lista de acción).
  const pruebasTerminando = rows.filter((n) => {
    if (n.activo || n.registro < ahora - 15 * MS_DIA) return false;
    const fin = n.registro + 15 * MS_DIA;
    return fin <= ahora + 3 * MS_DIA && fin > ahora - MS_DIA;
  }).length;

  const mrrCup = vigentes.reduce((s, n) => s + (PRECIOS_PLAN[n.plan] ?? 0), 0);
  const arpuCup = activos > 0 ? Math.round(mrrCup / activos) : 0;

  const porPlan = vigentes.reduce<Record<string, number>>((acc, n) => {
    acc[n.plan] = (acc[n.plan] ?? 0) + 1;
    return acc;
  }, {});

  const nuevos = rows.filter((n) => n.registro >= ahora - dias * MS_DIA).length;
  const nuevosPrev = rows.filter(
    (n) =>
      n.registro >= ahora - 2 * dias * MS_DIA &&
      n.registro < ahora - dias * MS_DIA
  ).length;

  const renovaciones7 = vigentes.filter(
    (n) => n.expiracion <= ahora + 7 * MS_DIA
  ).length;
  const renovaciones30 = vigentes.filter(
    (n) => n.expiracion <= ahora + 30 * MS_DIA
  ).length;
  const montoRenovaciones30 = vigentes
    .filter((n) => n.expiracion <= ahora + 30 * MS_DIA)
    .reduce((s, n) => s + (PRECIOS_PLAN[n.plan] ?? 0), 0);

  // Registros por día (del rango seleccionado) para el mini gráfico de barras.
  const registrosPorDia: { dia: string; total: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(ahora - i * MS_DIA);
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate()).getTime();
    const totalDia = rows.filter(
      (n) => n.registro >= inicio && n.registro < inicio + MS_DIA
    ).length;
    registrosPorDia.push({
      dia: dia.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit' }),
      total: totalDia,
    });
  }

  // ---- Ingreso real y desgloses (códigos usados) ----
  const ingresoRealCup = ingresosReales.reduce((s, c) => s + (c.precio_pagado ?? 0), 0);
  const ticketPromedio =
    ingresosReales.length > 0
      ? Math.round(ingresoRealCup / ingresosReales.length)
      : 0;
  const duracionMedia =
    ingresosReales.length > 0
      ? Math.round(
          (ingresosReales.reduce((s, c) => s + (c.duracion_meses ?? 0), 0) /
            ingresosReales.length) *
            10
        ) / 10
      : 0;

  const porMetodo: Record<string, number> = {};
  for (const c of ingresosReales) {
    const m = String(c.metodo_pago ?? 'efectivo');
    porMetodo[m] = (porMetodo[m] ?? 0) + (c.precio_pagado ?? 0);
  }

  // Tiempo medio prueba→pago: días entre registro y primer canje.
  const registroMsPorId = new Map(rows.map((r) => [r.id, r.registro]));
  let sumaDiasPago = 0;
  let casosPago = 0;
  for (const c of ingresosReales) {
    if (!c.negocio_id || !c.usado_en) continue;
    const reg = registroMsPorId.get(String(c.negocio_id));
    if (!reg) continue;
    const d = (new Date(c.usado_en).getTime() - reg) / MS_DIA;
    if (d >= 0 && d <= 365) {
      sumaDiasPago += d;
      casosPago++;
    }
  }
  const diasPruebaAPago = casosPago > 0 ? Math.round(sumaDiasPago / casosPago) : null;

  // Ingresos por mes (últimos 6 meses completos + actual).
  const ingresosPorMesMap = new Map<string, number>();
  for (const c of rIngresosMeses.data ?? []) {
    const k = String(c.usado_en).slice(0, 7);
    ingresosPorMesMap.set(k, (ingresosPorMesMap.get(k) ?? 0) + (c.precio_pagado ?? 0));
  }
  const ingresosPorMes: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth() - i, 1));
    const k = d.toISOString().slice(0, 7);
    ingresosPorMes.push({
      mes: d.toLocaleDateString('es-CU', { month: 'short', timeZone: 'UTC' }),
      total: ingresosPorMesMap.get(k) ?? 0,
    });
  }

  // Top 10 clientas por pago acumulado (LTV).
  const ltvPorNegocio = new Map<string, number>();
  for (const c of ingresosReales) {
    if (!c.negocio_id) continue;
    const k = String(c.negocio_id);
    ltvPorNegocio.set(k, (ltvPorNegocio.get(k) ?? 0) + (c.precio_pagado ?? 0));
  }
  const nombreDe = new Map(vivos.map((n) => [String(n.id), n]));
  const topClientas = Array.from(ltvPorNegocio.entries())
    .map(([id, monto]) => ({
      nombre: nombreDe.get(id)?.nombre_negocio ?? '(negocio eliminado)',
      email: nombreDe.get(id)?.email ?? '',
      monto,
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10);

  // ---- Actividad de la app desde el detalle limpio ----
  const ventasPorDiaMap = new Map<string, number>();
  const monedaResumen: Record<string, number> = {};
  const vendedoresHoy = new Set<string>();
  let gmvCup = 0;
  for (const v of rVentasDetalle.data ?? []) {
    const fechaStr = String(v.fecha);
    const dia = fechaStr.slice(0, 10);
    ventasPorDiaMap.set(dia, (ventasPorDiaMap.get(dia) ?? 0) + 1);
    if (dia === hoyStr && v.user_id) vendedoresHoy.add(String(v.user_id));
    const m = String(v.moneda ?? 'CUP');
    monedaResumen[m] = (monedaResumen[m] ?? 0) + 1;
    // Facturación estimada en CUP con el TC publicado de cada clienta.
    const bruto = Math.max(0, (Number(v.precio) || 0) - (Number(v.descuento) || 0));
    if (m === 'USD') gmvCup += bruto * tcDe(String(v.user_id)).usd;
    else if (m === 'MLC') gmvCup += bruto * tcDe(String(v.user_id)).mlc;
    else gmvCup += bruto;
  }
  const actividadPorDia: { dia: string; ventas: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(ahora - i * MS_DIA);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    actividadPorDia.push({
      dia: d.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit' }),
      ventas: ventasPorDiaMap.get(k) ?? 0,
    });
  }

  // Pulso de uso real: cuántas clientas vendieron hoy y en 7 días.
  const hace7Ms = ahora - 7 * MS_DIA;
  const vendedores7 = new Set<string>();
  for (const v of rVentasDetalle.data ?? []) {
    const f = new Date(String(v.fecha)).getTime();
    if (f >= hace7Ms) vendedores7.add(String(v.user_id));
  }

  // ---- Retención y conversión honesta ----
  const pagosPorNegocio = new Map<string, number>();
  for (const c of codigosConNegocio) {
    const k = String(c.negocio_id);
    pagosPorNegocio.set(k, (pagosPorNegocio.get(k) ?? 0) + 1);
  }
  const conPago = pagosPorNegocio.size;
  let renovados = 0;
  pagosPorNegocio.forEach((n) => {
    if (n >= 2) renovados++;
  });
  const retencion = conPago > 0 ? Math.round((renovados / conPago) * 100) : 0;

  // Conversión medida SOLO sobre pruebas terminadas (>15 días): las pruebas
  // en curso no penalizan (antes bajaban el % sin haber fallado aún).
  const expiradasSinPagar = rows.filter(
    (n) =>
      !n.activo &&
      n.registro > 0 &&
      n.registro < ahora - 15 * MS_DIA &&
      !pagosPorNegocio.has(n.id)
  ).length;
  const denominadorConversion = conPago + expiradasSinPagar;
  const conversion =
    denominadorConversion > 0
      ? Math.round((conPago / denominadorConversion) * 100)
      : 0;

  // ---- Inactivas: sin ventas sincronizadas en los últimos 30 días ----
  const hace30Ms = ahora - 30 * MS_DIA;
  const activasConDatos = new Set<string>();
  for (const v of rVentasDetalle.data ?? []) {
    const f = new Date(String(v.fecha)).getTime();
    if (f >= hace30Ms && v.user_id) activasConDatos.add(String(v.user_id));
  }
  const inactivas30 = vivos.filter((n) => !activasConDatos.has(String(n.id))).length;

  return {
    fallos,
    dias,
    total,
    activos,
    enPrueba,
    expiradasSinActivar,
    enPapelera,
    vencidasSinRenovar: vencidasSinRenovar.length,
    pruebasTerminando,
    porPlan,
    codigosGenerados: codigosGeneradosFinal,
    codigosUsados: codigosUsadosFinal,
    codigosPorVencer,
    codigosVencidosSinUsar,
    ingresoRealCup,
    mrrCup,
    arpuCup,
    gmvCup: Math.round(gmvCup),
    ticketPromedio,
    duracionMedia,
    nuevos,
    nuevosDelta: deltaPct(nuevos, nuevosPrev),
    renovaciones7,
    renovaciones30,
    montoRenovaciones30,
    registrosPorDia,
    actividadPorDia,
    ventasRango,
    ventasDelta: deltaPct(ventasRango, ventasRangoPrev),
    gastosRango,
    gastosDelta: deltaPct(gastosRango, gastosRangoPrev),
    monedaResumen,
    porMetodo,
    conversion,
    renovados,
    retencion,
    inactivas30,
    vendedoresHoy: vendedoresHoy.size,
    vendedores7: vendedores7.size,
    diasPruebaAPago,
    ingresosPorMes,
    topClientas,
    errores7,
    tcDisponible: negocios.length > 0 && negocios[0].tc_usd !== undefined,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSession();
  const rango = Number(searchParams?.rango);
  const dias = (RANGOS as readonly number[]).includes(rango)
    ? rango
    : 7;
  const stats = await getStats(dias);

  const flecha = (d: number | null) =>
    d === null ? '' : d >= 0 ? ` ↑${d}%` : ` ↓${Math.abs(d)}%`;

  const cards = [
    { label: 'Negocios Registrados', value: stats.total, color: 'bg-blue-500', icon: '🏪' },
    {
      label: 'Activos (vigentes)',
      value: stats.activos,
      color: 'bg-emerald-500',
      icon: '✅',
      title: 'Suscripción pagada y sin vencer. Las vencidas-no-desactivadas NO cuentan aquí.',
    },
    { label: 'En Prueba', value: stats.enPrueba, color: 'bg-yellow-500', icon: '⏳' },
    {
      label: 'Vencidas sin renovar',
      value: stats.vencidasSinRenovar,
      color: 'bg-red-500',
      icon: '📞',
      title: 'Cuentas activas cuyo plan ya venció: lista directa de cobro pendiente.',
    },
    {
      label: 'Ingresos Mensuales (MRR)',
      value: `${(stats.mrrCup / 1000).toFixed(1)}k CUP`,
      color: 'bg-purple-500',
      icon: '💰',
      title: 'Solo negocios vigentes (antes inflaba con vencidas).',
    },
    {
      label: 'Ingreso Acumulado',
      value: `${(stats.ingresoRealCup / 1000).toFixed(1)}k CUP`,
      color: 'bg-indigo-500',
      icon: '🏦',
    },
    { label: 'ARPU', value: `${stats.arpuCup.toLocaleString()} CUP`, color: 'bg-purple-400', icon: '🧮', title: 'Ingreso mensual medio por clienta activa.' },
    {
      label: `Nuevos (${stats.dias} días)`,
      value: `${stats.nuevos}${flecha(stats.nuevosDelta)}`,
      color: 'bg-sky-500',
      icon: '🆕',
      title: 'Comparado con el rango anterior del mismo tamaño.',
    },
    { label: 'Próx. Renovaciones (7d)', value: stats.renovaciones7, color: 'bg-orange-500', icon: '⏰' },
    {
      label: 'Conversión a Pago',
      value: `${stats.conversion}%`,
      color: 'bg-lime-600',
      icon: '📈',
      title: 'Sobre pruebas TERMINADAS: convertidas vs expiradas sin pagar.',
    },
    { label: 'Códigos Generados', value: stats.codigosGenerados, color: 'bg-cyan-500', icon: '🎟️' },
    { label: 'Códigos Usados', value: stats.codigosUsados, color: 'bg-teal-500', icon: '✅' },
    { label: 'Códigos por Vencer (3d)', value: stats.codigosPorVencer, color: 'bg-amber-500', icon: '⏱️' },
    {
      label: 'Códigos VENCIDOS sin usar',
      value: stats.codigosVencidosSinUsar,
      color: 'bg-rose-600',
      icon: '💀',
      title: 'Generados, nunca canjeados y ya expirados: recontacta para recuperar la venta.',
    },
    {
      label: `Ventas válidas (${stats.dias}d)`,
      value: `${stats.ventasRango}${flecha(stats.ventasDelta)}`,
      color: 'bg-violet-500',
      icon: '🧾',
      title: 'Excluye devueltas y borradas (antes contaba actividad fantasma).',
    },
    {
      label: `Gastos (${stats.dias}d)`,
      value: `${stats.gastosRango}${flecha(stats.gastosDelta)}`,
      color: 'bg-pink-500',
      icon: '💸',
    },
    {
      label: 'Facturación clientas (est.)',
      value: `${(stats.gmvCup / 1000).toFixed(1)}k CUP`,
      color: 'bg-emerald-700',
      icon: '🌍',
      title: 'Ventas del rango convertidas a CUP con el TC que cada clienta publica desde la app.',
    },
    {
      label: 'Vendieron HOY',
      value: stats.vendedoresHoy,
      color: 'bg-green-600',
      icon: '🔥',
      title: 'Negocios distintos con al menos una venta hoy: pulso real de uso.',
    },
    { label: 'Vendieron (7d)', value: stats.vendedores7, color: 'bg-teal-600', icon: '📊' },
    {
      label: 'Errores reportados (7d)',
      value: stats.errores7,
      color: 'bg-gray-700',
      icon: '🐞',
      title: 'Entradas en app_logs de los últimos 7 días.',
    },
    {
      label: 'Retención (renuevan)',
      value: `${stats.retencion}%`,
      color: 'bg-fuchsia-600',
      icon: '🔁',
      title: 'Clientas con ≥2 códigos canjeados sobre las que pagaron alguna vez.',
    },
    { label: 'Clientas inactivas (30d)', value: stats.inactivas30, color: 'bg-stone-500', icon: '💤' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {RANGOS.map((r) => (
            <a
              key={r}
              href={`/dashboard?rango=${r}`}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${
                stats.dias === r
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r} días
            </a>
          ))}
        </div>
      </div>

      {/* Datos parciales: alguna consulta falló (red/Supabase). Se muestra lo
          que sí llegó y se avisa — los ceros NO son verdad. */}
      {stats.fallos.length > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900"
        >
          <p className="font-bold">⚠️ Datos parciales</p>
          <p className="mt-1">
            No se pudieron leer: {stats.fallos.join(', ')}. Las cifras de esas
            secciones pueden mostrarse como cero. Recarga la página para
            reintentar.
          </p>
        </div>
      )}

      {/* Acciones de hoy: convierte números en tareas con enlace directo */}
      <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-1">🎯 Acciones de hoy</h2>
        <p className="text-sm text-gray-500 mb-4">
          Lo que más rápido se convierte en dinero o evita perderlo.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="/dashboard/negocios" className="group bg-red-50 hover:bg-red-100 transition rounded-lg p-4">
            <p className="text-3xl font-black text-red-700">{stats.vencidasSinRenovar}</p>
            <p className="text-xs text-red-600 font-semibold mt-1">Vencidas sin renovar</p>
            <p className="text-[11px] text-red-400 mt-1 group-hover:text-red-500">Llámalas → cobro pendiente</p>
          </a>
          <a href="/dashboard/codigos" className="group bg-amber-50 hover:bg-amber-100 transition rounded-lg p-4">
            <p className="text-3xl font-black text-amber-700">{stats.codigosPorVencer}</p>
            <p className="text-xs text-amber-600 font-semibold mt-1">Códigos por vencer (3d)</p>
            <p className="text-[11px] text-amber-400 mt-1 group-hover:text-amber-500">Recuérdales canjear</p>
          </a>
          <a href="/dashboard/codigos" className="group bg-rose-50 hover:bg-rose-100 transition rounded-lg p-4">
            <p className="text-3xl font-black text-rose-700">{stats.codigosVencidosSinUsar}</p>
            <p className="text-xs text-rose-600 font-semibold mt-1">Códigos ya vencidos</p>
            <p className="text-[11px] text-rose-400 mt-1 group-hover:text-rose-500">Ofrece uno nuevo</p>
          </a>
          <a href="/dashboard/negocios" className="group bg-yellow-50 hover:bg-yellow-100 transition rounded-lg p-4">
            <p className="text-3xl font-black text-yellow-700">{stats.pruebasTerminando}</p>
            <p className="text-xs text-yellow-600 font-semibold mt-1">Pruebas terminan ≤3d</p>
            <p className="text-[11px] text-yellow-400 mt-1 group-hover:text-yellow-500">Momento exacto de ofrecer el plan</p>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" title={card.title}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{card.icon}</span>
              <span className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${card.color}`}>
                {card.label.split(' ')[0]}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Activos por plan (vigentes)</h2>
          <div className="space-y-3">
            {Object.entries(stats.porPlan).length === 0 && (
              <p className="text-sm text-gray-500">Aún no hay suscriptores activos.</p>
            )}
            {Object.entries(stats.porPlan).map(([plan, n]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className="capitalize text-sm text-gray-600">{plan}</span>
                <span className="text-sm font-bold text-gray-800">
                  {n} · {((PRECIOS_PLAN[plan] ?? 0) * n).toLocaleString()} CUP/mes
                </span>
              </div>
            ))}
          </div>
          {stats.enPapelera > 0 && (
            <p className="text-xs text-gray-500 mt-4">🗑️ {stats.enPapelera} en la papelera.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Suscripciones</h2>
          <p className="text-sm text-gray-500 mb-4">
            El acumulado es lo cobrado por códigos canjeados. El MRR estima la
            recurrencia de los negocios VIGENTES (las vencidas se listan arriba como cobro pendiente).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-emerald-700">{stats.activos}</p>
              <p className="text-xs text-emerald-600">Vigentes</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-red-700">{stats.vencidasSinRenovar}</p>
              <p className="text-xs text-red-600">Vencidas sin renovar</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-yellow-700">{stats.enPrueba}</p>
              <p className="text-xs text-yellow-600">En prueba</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-700">{stats.expiradasSinActivar}</p>
              <p className="text-xs text-gray-500">Expiradas / sin activar</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-indigo-700">
                {stats.codigosUsados}/{stats.codigosGenerados}
              </p>
              <p className="text-xs text-indigo-600">Códigos usados</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Registros últimos {stats.dias} días
          </h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {(() => {
              const max = Math.max(1, ...stats.registrosPorDia.map((x) => x.total));
              return stats.registrosPorDia.map((d) => {
                const altura = Math.max(4, Math.round((d.total / max) * 100));
                return (
                  <div key={d.dia} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-xs font-bold text-gray-700">{d.total}</span>
                    <div className="w-full rounded-t bg-indigo-500" style={{ height: `${altura}px` }} />
                    <span className="text-[10px] text-gray-500">{d.dia}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Actividad real de la app (ventas válidas)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Ventas sincronizadas por día, excluyendo devueltas y borradas.
          </p>
          <div className="flex items-end justify-between gap-2 h-40">
            {(() => {
              const maxAct = Math.max(1, ...stats.actividadPorDia.map((x) => x.ventas));
              return stats.actividadPorDia.map((d) => {
                const altura = Math.max(4, Math.round((d.ventas / maxAct) * 100));
                return (
                  <div key={d.dia} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-xs font-bold text-gray-700">{d.ventas}</span>
                    <div className="w-full rounded-t bg-violet-500" style={{ height: `${altura}px` }} />
                    <span className="text-[10px] text-gray-500">{d.dia}</span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <div className="bg-violet-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-violet-700">
                {stats.ventasRango}
                {stats.ventasDelta !== null && (
                  <span className={`text-sm ml-1 ${stats.ventasDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {flecha(stats.ventasDelta)}
                  </span>
                )}
              </p>
              <p className="text-xs text-violet-600">Ventas ({stats.dias}d)</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-rose-700">{stats.gastosRango}</p>
              <p className="text-xs text-rose-600">Gastos ({stats.dias}d)</p>
            </div>
            <div className="bg-sky-50 rounded-lg p-4">
              <p className="text-xl font-bold text-sky-700">
                {Object.entries(stats.monedaResumen)
                  .map(([m, n]) => `${m}: ${n}`)
                  .join(' · ') || '—'}
              </p>
              <p className="text-xs text-sky-600">Ventas por moneda</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xl font-bold text-gray-700">
                {Object.entries(stats.porMetodo)
                  .map(([m, n]) => `${m}: ${Math.round(n).toLocaleString()} CUP`)
                  .join(' · ') || '—'}
              </p>
              <p className="text-xs text-gray-600">Ingreso por método</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Ingresos por mes (códigos canjeados)</h2>
          <div className="flex items-end justify-between gap-3 h-40">
            {(() => {
              const maxMes = Math.max(1, ...stats.ingresosPorMes.map((x) => x.total));
              return stats.ingresosPorMes.map((m) => {
                const altura = Math.max(4, Math.round((m.total / maxMes) * 100));
                return (
                  <div key={m.mes} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-xs font-bold text-gray-700">
                      {m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total}
                    </span>
                    <div className="w-full rounded-t bg-purple-500" style={{ height: `${altura}px` }} />
                    <span className="text-[10px] text-gray-500 capitalize">{m.mes}</span>
                  </div>
                );
              });
            })()}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Tendencia real de cobros mes a mes (el acumulado siempre sube y no dice nada).
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2">🏆 Top clientas por pago acumulado</h2>
          <p className="text-sm text-gray-500 mb-4">
            Tu lista VIP: a quién cuidar y premiar por lealtad.
          </p>
          <div className="space-y-2 max-h-56 overflow-auto">
            {stats.topClientas.length === 0 && (
              <p className="text-sm text-gray-500">Todavía no hay canjes registrados.</p>
            )}
            {stats.topClientas.map((c, i) => (
              <div key={c.email + i} className="flex items-center justify-between text-sm border-b border-gray-50 pb-1">
                <span className="truncate mr-2">
                  <span className="font-bold text-gray-500 mr-2">#{i + 1}</span>
                  <span className="text-gray-700 font-medium">{c.nombre}</span>
                  <span className="text-gray-500 ml-2 hidden sm:inline">{c.email}</span>
                </span>
                <span className="font-bold text-emerald-700 whitespace-nowrap">
                  {Math.round(c.monto).toLocaleString()} CUP
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Próximas renovaciones</h2>
          <p className="text-sm text-gray-500 mb-4">Negocios vigentes que vencen en los próximos 7 y 30 días.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-700">{stats.renovaciones7}</p>
              <p className="text-xs text-orange-600">Renovaciones 7 días</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-amber-700">{stats.renovaciones30}</p>
              <p className="text-xs text-amber-600">Renovaciones 30 días</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-violet-700">
                {(stats.montoRenovaciones30 / 1000).toFixed(1)}k CUP
              </p>
              <p className="text-xs text-violet-600">Ingreso esperado 30d</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Ticket promedio: <strong>{stats.ticketPromedio.toLocaleString()} CUP</strong> · Duración media:{' '}
              <strong>{stats.duracionMedia || '—'} meses</strong>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Retención y activación</h2>
          <p className="text-sm text-gray-500 mb-4">
            Retención sobre quienes pagaron alguna vez; conversión medida solo sobre pruebas terminadas.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" title={stats.diasPruebaAPago !== null ? 'Días promedio entre el registro y el primer código canjeado' : undefined}>
            <div className="bg-fuchsia-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-fuchsia-700">{stats.retencion}%</p>
              <p className="text-xs text-fuchsia-600">Retención (renuevan)</p>
            </div>
            <div className="bg-fuchsia-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-fuchsia-700">{stats.renovados}</p>
              <p className="text-xs text-fuchsia-600">Clientas que renovaron</p>
            </div>
            <div className="bg-lime-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-lime-700">
                {stats.diasPruebaAPago !== null ? `${stats.diasPruebaAPago} d` : '—'}
              </p>
              <p className="text-xs text-lime-600">Registro → primer pago</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-stone-700">{stats.inactivas30}</p>
              <p className="text-xs text-stone-600">Inactivas (30 días)</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Funnel de conversión ──────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">🔄 Funnel de conversión</h2>
        <p className="text-sm text-gray-500 mb-6">
          De registrados a clientes de pago. Las etapas se miden sobre el total histórico.
        </p>
        {(() => {
          const etapas = [
            { label: 'Registrados', total: stats.total, color: 'bg-blue-500', textColor: 'text-blue-700' },
            { label: 'Con prueba activa', total: stats.enPrueba + stats.activos + stats.vencidasSinRenovar, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
            { label: 'Primer pago', total: stats.conversion > 0 ? Math.round((stats.total * stats.conversion) / 100) : stats.activos, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
            { label: 'Renovaron', total: stats.renovados, color: 'bg-purple-500', textColor: 'text-purple-700' },
          ];
          const maxEtapas = Math.max(1, ...etapas.map((e) => e.total));
          return (
            <div className="space-y-3">
              {etapas.map((etapa, i) => {
                const pct = stats.total > 0 ? Math.round((etapa.total / stats.total) * 100) : 0;
                const ancho = Math.max(8, Math.round((etapa.total / maxEtapas) * 100));
                return (
                  <div key={etapa.label} className="flex items-center gap-3">
                    <span className={`w-36 text-sm font-semibold ${etapa.textColor} text-right shrink-0`}>
                      {etapa.label}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                      <div
                        className={`${etapa.color} h-full rounded-full flex items-center pl-3 transition-all`}
                        style={{ width: `${ancho}%` }}
                      >
                        <span className="text-xs font-bold text-white whitespace-nowrap">
                          {etapa.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-blue-700">{stats.conversion}%</p>
            <p className="text-[11px] text-gray-500">Registro → Pago</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-fuchsia-700">{stats.retencion}%</p>
            <p className="text-[11px] text-gray-500">Pago → Renovación</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-rose-700">{stats.inactivas30}</p>
            <p className="text-[11px] text-gray-500">Inactivas 30d</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-700">
              {stats.diasPruebaAPago !== null ? `${stats.diasPruebaAPago}d` : '—'}
            </p>
            <p className="text-[11px] text-gray-500">Tiempo medio registro→pago</p>
          </div>
        </div>
      </div>
    </div>
  );
}
