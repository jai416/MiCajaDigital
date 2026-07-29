import { supabaseAdmin } from '@/lib/supabase';
import NegociosTable from './NegociosTable';

async function getNegocios() {
  const { data, error } = await supabaseAdmin
    .from('negocios')
    .select('*')
    .order('fecha_registro', { ascending: false });

  if (error) {
    console.error('Error fetching negocios:', error);
    return [];
  }
  return data ?? [];
}

export default async function NegociosPage() {
  const negocios = await getNegocios();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Negocios</h1>
        <span className="text-sm text-gray-500">{negocios.length} registros</span>
      </div>
      <NegociosTable negocios={negocios} />
    </div>
  );
}
