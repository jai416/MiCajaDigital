import { supabaseAdmin } from '@/lib/supabase';
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

async function getStats(dias: number) {
  // Consultas globales independientes: se lanzan en paralelo (una sola tanda)
  // para que el dashboard cargue en el tiempo de la más lenta, no en la suma.
  const enTresDias = new Date(Date.now() + 3 * 86400000).toISOString();

  const [
    rNegocios,
    rCodigosGenerados,
    rCodigosUsados,
    rCodigosPorVencer,
    rIngresosReales,
  ] = await Promise.all([
    supabaseAdmin
      .from('negocios')
      .select('id, activo, plan, fecha_registro, fecha_expiracion, deleted_at'),
    supabaseAdmin
      .from('codigos_pago')
      .select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('codigos_pago')
      .select('*', { count: 'exact', head: true })
      .eq('usado', true),
    // Códigos por vencer en los próximos 3 días (todavía no canjeados).
    supabaseAdmin
      .from('codigos_pago')
      .select('*', { count: 'exact', head: true })
      .eq('usado', false)
      .lte('fecha_expiracion', enTresDias),
    // Ingreso real (lo pagado por códigos ya usados).
    supabaseAdmin
      .from('codigos_pago')
      .select('precio_pagado, metodo_pago')
      .eq('usado', true),
  ]);
  const negocios = rNegocios.data;
  const codigosGenerados = rCodigosGenerados.count;
  const codigosUsados = rCodigosUsados.count;
  const codigosPorVencer = rCodigosPorVencer.count;
  const ingresosReales = rIngresosReales.data;

  const ahora = Date.now();
  const msDia = 86400000;

  const vivos = (negocios ?? []).filter((n) => !n.deleted_at);
  const enPapelera = (negocios ?? []).length - vivos.length;

  const rows = vivos.map((n) => ({
    activo: !!n.activo,
    plan: (n.plan as string) ?? 'gratis',
    registro: n.fecha_registro ? new Date(n.fecha_registro).getTime() : 0,
    expiracion: n.fecha_expiracion
      ? new Date(n.fecha_expiracion).getTime()
      : 0,
  }));

  const total = rows.length;
  const activos = rows.filter((n) => n.activo).length;
  const enPrueba = rows.filter(
    (n) => !n.activo && n.registro >= ahora - 15 * msDia
  ).length;
  const inactivos = rows.filter(
    (n) => !n.activo && n.registro < ahora - 15 * msDia
  ).length;

  const porPlan = rows
    .filter((n) => n.activo)
    .reduce<Record<string, number>>((acc, n) => {
      acc[n.plan] = (acc[n.plan] ?? 0) + 1;
      return acc;
    }, {});

  const nuevos = rows.filter((n) => n.registro >= ahora - dias * msDia).length;

  const activosPorVencer = rows.filter((n) => n.activo && n.expiracion > ahora);
  const renovaciones7 = activosPorVencer.filter(
    (n) => n.expiracion <= ahora + 7 * msDia
  ).length;
  const renovaciones30 = activosPorVencer.filter(
    (n) => n.expiracion <= ahora + 30 * msDia
  ).length;
  const montoRenovaciones30 = activosPorVencer
    .filter((n) => n.expiracion <= ahora + 30 * msDia)
    .reduce((s, n) => s + (PRECIOS_PLAN[n.plan] ?? 0), 0);

  // Registros por día (del rango seleccionado) para el mini gráfico de barras.
  const registrosPorDia: { dia: string; total: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(ahora - i * msDia);
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate()).getTime();
    const totalDia = rows.filter(
      (n) => n.registro >= inicio && n.registro < inicio + msDia
    ).length;
    registrosPorDia.push({
      dia: dia.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit' }),
      total: totalDia,
    });
  }

  const ingresoRealCup = (ingresosReales ?? []).reduce(
    (s, c) => s + (c.precio_pagado ?? 0),
    0
  );
  const ingresoMensualCup = rows
    .filter((n) => n.activo)
    .reduce((s, n) => s + (PRECIOS_PLAN[n.plan] ?? 0), 0);

  // ---- Actividad de la app (métricas de uso) en el rango ----
  // Segunda tanda paralela: actividad, retención e inactividad juntas.
  const desde = new Date(ahora - (dias - 1) * msDia).toISOString().slice(0, 10);
  const desde30 = new Date(ahora - 30 * msDia).toISOString().slice(0, 10);
  const [
    rVentasRango,
    rGastosRango,
    rVentasPorDia,
    rVentasPorMoneda,
    rCodigosConNegocio,
    rVentas30,
    rGastos30,
  ] = await Promise.all([
    supabaseAdmin
      .from('ventas')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', desde),
    supabaseAdmin
      .from('gastos')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', desde),
    supabaseAdmin.from('ventas').select('fecha').gte('fecha', desde),
    supabaseAdmin.from('ventas').select('moneda').gte('fecha', desde),
    supabaseAdmin
      .from('codigos_pago')
      .select('negocio_id')
      .eq('usado', true)
      .not('negocio_id', 'is', null),
    supabaseAdmin.from('ventas').select('user_id').gte('fecha', desde30),
    supabaseAdmin.from('gastos').select('user_id').gte('fecha', desde30),
  ]);
  const ventasRango = rVentasRango.count;
  const gastosRango = rGastosRango.count;
  const ventasPorDia = rVentasPorDia.data;
  const ventasPorDiaMap = new Map<string, number>();
  for (const v of ventasPorDia ?? []) {
    const k = String(v.fecha).slice(0, 10);
    ventasPorDiaMap.set(k, (ventasPorDiaMap.get(k) ?? 0) + 1);
  }
  const actividadPorDia: { dia: string; ventas: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(ahora - i * msDia);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    actividadPorDia.push({
      dia: d.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit' }),
      ventas: ventasPorDiaMap.get(k) ?? 0,
    });
  }

  const ventasPorMoneda = rVentasPorMoneda.data;
  const monedaResumen: Record<string, number> = {};
  for (const v of ventasPorMoneda ?? []) {
    const m = String(v.moneda ?? 'CUP');
    monedaResumen[m] = (monedaResumen[m] ?? 0) + 1;
  }

  const porMetodo: Record<string, number> = {};
  for (const c of ingresosReales ?? []) {
    const m = String(c.metodo_pago ?? 'efectivo');
    porMetodo[m] = (porMetodo[m] ?? 0) + (c.precio_pagado ?? 0);
  }

  // ---- Retención: clientas que renovaron al menos una vez ----
  // Una "renovación" = negocio con ≥2 códigos canjeados (el primero activa, el
  // resto renueva). La retención es ese grupo sobre quienes pagaron alguna vez.
  const codigosConNegocio = rCodigosConNegocio.data;
  const pagosPorNegocio = new Map<string, number>();
  for (const c of codigosConNegocio ?? []) {
    const k = String(c.negocio_id);
    pagosPorNegocio.set(k, (pagosPorNegocio.get(k) ?? 0) + 1);
  }
  const conPago = pagosPorNegocio.size;
  let renovados = 0;
  pagosPorNegocio.forEach((n) => {
    if (n >= 2) renovados++;
  });

  // ---- Inactivas: sin ventas NI gastos sincronizados en los últimos 30 días ----
  const activasConDatos = new Set<string>();
  for (const v of rVentas30.data ?? []) activasConDatos.add(String(v.user_id));
  for (const g of rGastos30.data ?? []) activasConDatos.add(String(g.user_id));
  const inactivas30 = vivos.filter((n) => !activasConDatos.has(String(n.id))).length;

  return {
    dias,
    total,
    activos,
    enPrueba,
    inactivos,
    enPapelera,
    porPlan,
    codigosGenerados: codigosGenerados ?? 0,
    codigosUsados: codigosUsados ?? 0,
    codigosPorVencer: codigosPorVencer ?? 0,
    ingresoRealCup,
    ingresoMensualCup,
    nuevos,
    renovaciones7,
    renovaciones30,
    montoRenovaciones30,
    registrosPorDia,
    actividadPorDia,
    ventasRango: ventasRango ?? 0,
    gastosRango: gastosRango ?? 0,
    monedaResumen,
    porMetodo,
    conversion: total > 0 ? Math.round((activos / total) * 100) : 0,
    renovados,
    retencion: conPago > 0 ? Math.round((renovados / conPago) * 100) : 0,
    inactivas30,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const rango = Number(searchParams?.rango);
  const dias = (RANGOS as readonly number[]).includes(rango)
    ? rango
    : 7;
  const stats = await getStats(dias);

  const cards = [
    { label: 'Negocios Registrados', value: stats.total, color: 'bg-blue-500', icon: '🏪' },
    { label: 'Activos (Pagando)', value: stats.activos, color: 'bg-emerald-500', icon: '✅' },
    { label: 'En Prueba', value: stats.enPrueba, color: 'bg-yellow-500', icon: '⏳' },
    {
      label: 'Ingresos Mensuales',
      value: `${(stats.ingresoMensualCup / 1000).toFixed(1)}k CUP`,
      color: 'bg-purple-500',
      icon: '💰',
    },
    {
      label: 'Ingreso Acumulado',
      value: `${(stats.ingresoRealCup / 1000).toFixed(1)}k CUP`,
      color: 'bg-indigo-500',
      icon: '🏦',
    },
    { label: `Nuevos (${stats.dias} días)`, value: stats.nuevos, color: 'bg-sky-500', icon: '🆕' },
    {
      label: 'Próx. Renovaciones (7d)',
      value: stats.renovaciones7,
      color: 'bg-orange-500',
      icon: '⏰',
    },
    {
      label: 'Conversión a Pago',
      value: `${stats.conversion}%`,
      color: 'bg-lime-600',
      icon: '📈',
    },
    { label: 'Códigos Generados', value: stats.codigosGenerados, color: 'bg-cyan-500', icon: '🎟️' },
    { label: 'Códigos Usados', value: stats.codigosUsados, color: 'bg-teal-500', icon: '✅' },
    { label: 'Códigos por Vencer', value: stats.codigosPorVencer, color: 'bg-rose-500', icon: '⏰' },
    { label: 'Ventas registradas', value: stats.ventasRango, color: 'bg-violet-500', icon: '🧾' },
    { label: 'Retención (renuevan)', value: `${stats.retencion}%`, color: 'bg-fuchsia-600', icon: '🔁' },
    { label: 'Clientas inactivas (30d)', value: stats.inactivas30, color: 'bg-stone-500', icon: '💤' },
  ];

  const resumenPlanes = Object.entries(stats.porPlan).map(([plan, n]) => ({
    plan,
    n,
    precio: PRECIOS_PLAN[plan] ?? 0,
  }));

  const maxAct = Math.max(1, ...stats.actividadPorDia.map((x) => x.ventas));

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{card.icon}</span>
              <span className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${card.color}`}>
                {card.label.split(' ')[0]}
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Activos por plan</h2>
          <div className="space-y-3">
            {resumenPlanes.length === 0 && (
              <p className="text-sm text-gray-400">Aún no hay suscriptores activos.</p>
            )}
            {resumenPlanes.map((r) => (
              <div key={r.plan} className="flex items-center justify-between">
                <span className="capitalize text-sm text-gray-600">{r.plan}</span>
                <span className="text-sm font-bold text-gray-800">
                  {r.n} · {(r.precio * r.n).toLocaleString()} CUP/mes
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Suscripciones</h2>
          <p className="text-sm text-gray-500 mb-4">
            El ingreso acumulado refleja lo cobrado por los códigos ya canjeados. El
            mensual estima la recurrencia según el plan de cada negocio activo.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-emerald-700">{stats.activos}</p>
              <p className="text-xs text-emerald-600">Activos</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-yellow-700">{stats.enPrueba}</p>
              <p className="text-xs text-yellow-600">En prueba</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-700">{stats.inactivos}</p>
              <p className="text-xs text-gray-500">Sin plan</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Registros últimos {stats.dias} días
          </h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {stats.registrosPorDia.map((d) => {
              const max = Math.max(
                1,
                ...stats.registrosPorDia.map((x) => x.total)
              );
              const altura = Math.max(4, Math.round((d.total / max) * 100));
              return (
                <div key={d.dia} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-xs font-bold text-gray-700">
                    {d.total}
                  </span>
                  <div
                    className="w-full rounded-t bg-indigo-500"
                    style={{ height: `${altura}px` }}
                  />
                  <span className="text-[10px] text-gray-400">{d.dia}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Actividad de la app (ventas registradas)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Cuántas ventas registran tus clientas por día. Se sincroniza desde sus
            teléfonos, así que refleja el uso real de la app.
          </p>
          <div className="flex items-end justify-between gap-2 h-40">
            {stats.actividadPorDia.map((d) => {
              const altura = Math.max(4, Math.round((d.ventas / maxAct) * 100));
              return (
                <div key={d.dia} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-xs font-bold text-gray-700">
                    {d.ventas}
                  </span>
                  <div
                    className="w-full rounded-t bg-violet-500"
                    style={{ height: `${altura}px` }}
                  />
                  <span className="text-[10px] text-gray-400">{d.dia}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <div className="bg-violet-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-violet-700">{stats.ventasRango}</p>
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
                  .join(' · ')}
              </p>
              <p className="text-xs text-sky-600">Ventas por moneda</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xl font-bold text-gray-700">
                {Object.entries(stats.porMetodo)
                  .map(([m, n]) => `${m}: $${Math.round(n).toLocaleString()}`)
                  .join(' · ')}
              </p>
              <p className="text-xs text-gray-600">Ingreso por método</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Próximas renovaciones
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Negocios activos cuya suscripción vence en los próximos 7 y 30 días.
            Son la oportunidad de renovación más cercana.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-700">
                {stats.renovaciones7}
              </p>
              <p className="text-xs text-orange-600">Renovaciones 7 días</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-amber-700">
                {stats.renovaciones30}
              </p>
              <p className="text-xs text-amber-600">Renovaciones 30 días</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-violet-700">
                {(stats.montoRenovaciones30 / 1000).toFixed(1)}k CUP
              </p>
              <p className="text-xs text-violet-600">Ingreso esperado 30d</p>
            </div>
          </div>
          {stats.enPapelera > 0 && (
            <p className="text-xs text-gray-400 mt-4">
              🗑️ {stats.enPapelera} negocio(s) en la papelera.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Retención y reactivación
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            La retención mide a las clientas que pagaron más de una vez (renuevan
            tras el primer mes). Las inactivas no han sincronizado ventas ni
            gastos en 30 días: son la mejor lista para una campaña de
            reactivación.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-fuchsia-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-fuchsia-700">
                {stats.retencion}%
              </p>
              <p className="text-xs text-fuchsia-600">Retención (renuevan)</p>
            </div>
            <div className="bg-fuchsia-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-fuchsia-700">
                {stats.renovados}
              </p>
              <p className="text-xs text-fuchsia-600">Clientas que renovaron</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-stone-700">
                {stats.inactivas30}
              </p>
              <p className="text-xs text-stone-600">Inactivas (30 días)</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-xl font-bold text-emerald-700">
                {stats.enPrueba}
              </p>
              <p className="text-xs text-emerald-600">En prueba (por convertir)</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Registro de códigos
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Balance entre códigos generados y canjeados. Los "por vencer" son
            códigos generados, sin canjear, que expiran en los próximos 3 días:
            vale la pena recontactar a esas clientas.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-cyan-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-cyan-700">
                {stats.codigosGenerados}
              </p>
              <p className="text-xs text-cyan-600">Generados</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-teal-700">
                {stats.codigosUsados}
              </p>
              <p className="text-xs text-teal-600">Usados</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-rose-700">
                {stats.codigosPorVencer}
              </p>
              <p className="text-xs text-rose-600">Por vencer (3 días)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
