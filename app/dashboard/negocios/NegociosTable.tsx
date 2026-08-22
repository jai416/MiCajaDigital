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
  deleted_at: string | null;
}

type ModalTipo = 'editar' | 'renovar' | null;

const PLANES_VALIDOS = ['gratis', 'basico', 'pro', 'premium'];

export default function NegociosTable({ negocios }: { negocios: Negocio[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [modal, setModal] = useState<ModalTipo>(null);
  const [seleccion, setSeleccion] = useState<Negocio | null>(null);
  const [plan, setPlan] = useState('gratis');
  const [expiracion, setExpiracion] = useState('');
  const [dias, setDias] = useState('30');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const filtered = negocios.filter((n) => {
    const matchSearch =
      n.email.toLowerCase().includes(search.toLowerCase()) ||
      n.nombre_negocio.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    const enPapelera = !!n.deleted_at;
    if (filter === 'papelera') return enPapelera;
    if (enPapelera) return false;
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

  const cerrarModal = () => {
    setModal(null);
    setSeleccion(null);
    setError('');
  };

  const abrirEditar = (n: Negocio) => {
    setSeleccion(n);
    setPlan(PLANES_VALIDOS.includes(n.plan) ? n.plan : 'gratis');
    setExpiracion(n.fecha_expiracion ? n.fecha_expiracion.slice(0, 10) : '');
    setError('');
    setModal('editar');
  };

  const abrirRenovar = (n: Negocio) => {
    setSeleccion(n);
    setDias('30');
    setError('');
    setModal('renovar');
  };

  const handleToggle = async (id: string, current: boolean) => {
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !current }),
    });
    if (res.ok) router.refresh();
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Mover a la papelera "${nombre}"? Se podrá restaurar después.`)) return;
    const res = await fetch('/api/negocios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) router.refresh();
  };

  const handleRestaurar = async (id: string) => {
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deleted_at: null }),
    });
    if (res.ok) router.refresh();
  };

  const handleBorrarPermanente = async (id: string, nombre: string) => {
    if (
      !confirm(
        `⚠️ BORRADO DEFINITIVO de "${nombre}".\n\nSe eliminarán TODOS sus datos (ventas, gastos, catálogo, compras) y no se podrán recuperar.\n\n¿Continuar?`
      )
    )
      return;
    if (!confirm('Esta acción es irreversible. ¿Seguro que quieres eliminarlo para siempre?')) return;
    const res = await fetch('/api/negocios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, permanente: true }),
    });
    if (res.ok) router.refresh();
  };

  const handleGuardarEdicion = async () => {
    if (!seleccion) return;
    if (!PLANES_VALIDOS.includes(plan)) {
      setError('Plan no válido.');
      return;
    }
    const body: Record<string, unknown> = { id: seleccion.id, plan };
    if (expiracion) {
      const fecha = new Date(expiracion + 'T00:00:00Z');
      if (isNaN(fecha.getTime())) {
        setError('Fecha de expiración no válida.');
        return;
      }
      body.fecha_expiracion = expiracion + 'T00:00:00Z';
    }
    setCargando(true);
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setCargando(false);
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || 'Error al guardar.');
      return;
    }
    cerrarModal();
    router.refresh();
  };

  const handleRenovar = async () => {
    if (!seleccion) return;
    const nDias = Number(dias);
    if (isNaN(nDias) || nDias <= 0) {
      setError('Introduce un número de días válido.');
      return;
    }
    const ahora = Date.now();
    const vencimiento = new Date(seleccion.fecha_expiracion).getTime();
    // Si el negocio aún tiene días restantes, se extienden DESDE ese vencimiento
    // (igual que hace canjear_codigo); solo se cuenta desde hoy si ya venció.
    const base = isFinite(vencimiento) && vencimiento > ahora ? vencimiento : ahora;
    const fin = new Date(base);
    fin.setUTCDate(fin.getUTCDate() + nDias);
    const expiracion = fin.toISOString().slice(0, 10) + 'T00:00:00Z';
    setCargando(true);
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: seleccion.id, activo: true, fecha_expiracion: expiracion }),
    });
    setCargando(false);
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || 'Error al renovar.');
      return;
    }
    cerrarModal();
    router.refresh();
  };

  const mostrarPorVencer = (n: Negocio) => {
    if (!n.activo || !n.fecha_expiracion) return false;
    const exp = new Date(n.fecha_expiracion).getTime();
    const en3Dias = Date.now() + 3 * 86400000;
    return exp <= en3Dias;
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
          <option value="papelera">🗑️ Papelera</option>
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
            {filtered.map((n) => {
              const porVencer = mostrarPorVencer(n);
              return (
                <tr key={n.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium">{n.nombre_negocio}</td>
                  <td className="px-4 py-3 text-gray-500">{n.email}</td>
                  <td className="px-4 py-3 text-gray-500">{n.telefono || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        n.deleted_at
                          ? 'bg-gray-200 text-gray-600'
                          : porVencer
                            ? 'bg-amber-100 text-amber-700'
                            : n.activo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {n.deleted_at
                        ? 'Papelera'
                        : porVencer
                          ? 'Por vencer'
                          : n.activo
                            ? 'Activo'
                            : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(n.fecha_registro).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(n.fecha_expiracion).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="capitalize text-xs font-medium">{n.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {n.deleted_at ? (
                        <>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-gray-400 italic">
                              {new Date(n.deleted_at).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                            </span>
                            <span className="text-[11px] text-amber-600 italic">
                              Restáuralo para activar/renovar
                            </span>
                          </div>
                          <button
                            onClick={() => handleRestaurar(n.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          >
                            ♻️ Restaurar
                          </button>
                          <button
                            onClick={() => handleBorrarPermanente(n.id, n.nombre_negocio)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                            title="Eliminar definitivamente todos sus datos"
                          >
                            🗑️ Eliminar
                          </button>
                        </>
                      ) : (
                        <>
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
                            onClick={() => abrirEditar(n)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => abrirRenovar(n)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          >
                            Renovar
                          </button>
                          <button
                            onClick={() => handleDelete(n.id, n.nombre_negocio)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition"
                          >
                            🗑️ Papelera
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {modal && seleccion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={cerrarModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {modal === 'editar' ? 'Editar negocio' : 'Renovar suscripción'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {seleccion.nombre_negocio} · {seleccion.email}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {modal === 'editar' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Plan</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  >
                    {PLANES_VALIDOS.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Fecha de expiración <span className="text-gray-400">(dejar vacío para no cambiar)</span>
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={expiracion}
                    onChange={(e) => setExpiracion(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Días de renovación
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Se extiende desde el vencimiento actual (o desde hoy si ya venció), igual que
                  el canje de código.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={cerrarModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={modal === 'editar' ? handleGuardarEdicion : handleRenovar}
                disabled={cargando}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-semibold"
              >
                {cargando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
