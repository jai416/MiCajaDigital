import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getStats() {
  const { count: total } = await supabaseAdmin
    .from('negocios')
    .select('*', { count: 'exact', head: true });

  const { count: activos } = await supabaseAdmin
    .from('negocios')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true);

  const { data: enPrueba } = await supabaseAdmin
    .from('negocios')
    .select('id')
    .eq('activo', false)
    .gte('fecha_registro', new Date(Date.now() - 15 * 86400000).toISOString());

  const { count: inactivosConFecha } = await supabaseAdmin
    .from('negocios')
    .select('*', { count: 'exact', head: true })
    .eq('activo', false);

  return {
    total: total ?? 0,
    activos: activos ?? 0,
    enPrueba: enPrueba?.length ?? 0,
    inactivos: (inactivosConFecha ?? 0) - (enPrueba?.length ?? 0),
  };
}

export default async function DashboardPage() {
  const stats = await getStats();
  const ingresosEstimados = stats.activos * 15;

  const cards = [
    { label: 'Negocios Registrados', value: stats.total, color: 'bg-blue-500', icon: '🏪' },
    { label: 'Activos (Pagando)', value: stats.activos, color: 'bg-emerald-500', icon: '✅' },
    { label: 'En Prueba', value: stats.enPrueba, color: 'bg-yellow-500', icon: '⏳' },
    { label: 'Ingresos Mensuales', value: `$${ingresosEstimados} USD`, color: 'bg-purple-500', icon: '💰' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
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
    </div>
  );
}
