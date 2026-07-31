'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Negocio {
  id: string;
  email: string;
  nombre_negocio: string;
  telefono: string;
  activo: boolean;
  plan: string;
  fecha_registro: string;
  fecha_expiracion: string;
}

export default function NegociosTable({ negocios }: { negocios: Negocio[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');

  const filtered = negocios.filter((n) => {
    const matchSearch =
      n.email.toLowerCase().includes(search.toLowerCase()) ||
      n.nombre_negocio.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'todos') return true;
    if (filter === 'activos') return n.activo;
    if (filter === 'inactivos') return !n.activo;
    if (filter === 'prueba') {
      const quinceDias = 15 * 86400000;
      const registro = new Date(n.fecha_registro).getTime();
      return !n.activo && Date.now() - registro < quinceDias;
    }
    return true;
  });

  const handleToggle = async (id: string, current: boolean) => {
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !current }),
    });
    if (res.ok) router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este negocio permanentemente?')) return;
    const res = await fetch('/api/negocios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) router.refresh();
  };

  const handleEdit = async (id: string) => {
    const plan = prompt('Nuevo plan (gratis/basico/pro):');
    if (!plan) return;
    const expiracion = prompt('Nueva fecha de expiración (YYYY-MM-DD):');
    if (!expiracion) return;

    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, plan, fecha_expiracion: expiracion }),
    });
    if (res.ok) router.refresh();
  };

  const handleRenovar = async (id: string) => {
    const dias = prompt('¿Cuántos días de renovación? (30 o 90)', '30');
    if (!dias) return;
    const n = parseInt(dias, 10);
    if (isNaN(n) || n <= 0) return;
    const expiracion = new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: true, fecha_expiracion: expiracion }),
    });
    if (res.ok) router.refresh();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por email o nombre..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="prueba">En prueba</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Negocio</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Registro</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Expira</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Plan</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n) => (
              <tr key={n.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium">{n.nombre_negocio}</td>
                <td className="px-4 py-3 text-gray-500">{n.email}</td>
                <td className="px-4 py-3 text-gray-500">{n.telefono || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                      n.activo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {n.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(n.fecha_registro).toLocaleDateString('es-ES')}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(n.fecha_expiracion).toLocaleDateString('es-ES')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="capitalize text-xs font-medium">{n.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleToggle(n.id, n.activo)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        n.activo
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {n.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleEdit(n.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleRenovar(n.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                    >
                      Renovar
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron negocios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
