'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { fechaCorta } from '@/lib/formato';
import BackupButton from './BackupButton';

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

interface Paginacion {
  pagina: number;
  totalPaginas: number;
  q: string;
  plan?: string;
  estado?: string;
  expiran?: string;
}

const MS_DIA = 86400000;
// OJO: el trigger crea las pruebas con plan='pro' y activo=false (NUNCA con
// 'gratis'). El valor 'gratis' existe en el CHECK de la DB pero la app lo
// trata como "Pro gratis para siempre" (suscripcion.dart) — no ofrecerlo
// desde el panel. Solo los planes de pago y la prueba temporal (que es un
// 'pro' inactivo con registro < 15 días).
const PLANES_VALIDOS = ['basico', 'pro', 'premium'];

// Descripciones para el modal de edición (precios de config/precios.json).
const DESCRIPCION_PLAN: Record<string, string> = {
  basico: 'Básico · 2.500 CUP/mes',
  pro: 'Pro · 5.000 CUP/mes',
  premium: 'Premium · 7.000 CUP/mes',
};

function labelPlan(p: string): string {
  if (p === 'basico') return 'Básico';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

interface InfoSuscripcion {
  estado: 'activo' | 'prueba' | 'porVencer' | 'vencido' | 'papelera';
  etiqueta: string;
  detalle: string;
  dias: number | null;
}

// Resumen legible del estado de la suscripción de un negocio.
function infoSuscripcion(n: Negocio): InfoSuscripcion {
  if (n.deleted_at) {
    return { estado: 'papelera', etiqueta: 'Papelera', detalle: `En papelera desde ${fechaCorta(n.deleted_at)}`, dias: null };
  }
  const ahora = Date.now();
  const exp = n.fecha_expiracion ? new Date(n.fecha_expiracion).getTime() : 0;
  const registro = n.fecha_registro ? new Date(n.fecha_registro).getTime() : 0;
  const dias = exp ? Math.ceil((exp - ahora) / MS_DIA) : null;

  if (exp > ahora && dias !== null && dias <= 3 && n.activo) {
    return { estado: 'porVencer', etiqueta: 'Por vencer', detalle: `Vence en ${dias} día${dias === 1 ? '' : 's'} (${fechaCorta(n.fecha_expiracion)})`, dias };
  }
  if (n.activo && exp > ahora) {
    return { estado: 'activo', etiqueta: 'Activo', detalle: `Vence el ${fechaCorta(n.fecha_expiracion)}${dias !== null ? ` (${dias} días)` : ''}`, dias };
  }
  if (!n.activo && registro && ahora - registro < 15 * MS_DIA) {
    const diasPrueba = Math.max(0, Math.ceil((registro + 15 * MS_DIA - ahora) / MS_DIA));
    return { estado: 'prueba', etiqueta: 'En prueba', detalle: `Prueba: ${diasPrueba} día${diasPrueba === 1 ? '' : 's'} restantes · vence ${fechaCorta(n.fecha_expiracion)}`, dias: diasPrueba };
  }
  if (exp && exp <= ahora) {
    return { estado: 'vencido', etiqueta: 'Vencido', detalle: `Venció el ${fechaCorta(n.fecha_expiracion)}`, dias };
  }
  if (!n.activo) {
    return { estado: 'vencido', etiqueta: 'Inactivo', detalle: 'Sin suscripción activa', dias: null };
  }
  return { estado: 'activo', etiqueta: 'Activo', detalle: n.fecha_expiracion ? `Vence el ${fechaCorta(n.fecha_expiracion)}` : 'Sin fecha de expiración', dias };
}

const CLASES_BADGE: Record<InfoSuscripcion['estado'], string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  prueba: 'bg-blue-100 text-blue-700',
  porVencer: 'bg-amber-100 text-amber-700',
  vencido: 'bg-red-100 text-red-600',
  papelera: 'bg-gray-200 text-gray-600',
};

export default function NegociosTable({
  negocios,
  paginacion,
}: {
  negocios: Negocio[];
  paginacion?: Paginacion;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [modal, setModal] = useState<ModalTipo>(null);
  const [seleccion, setSeleccion] = useState<Negocio | null>(null);
  const [plan, setPlan] = useState('pro');
  const [expiracion, setExpiracion] = useState('');
  const [dias, setDias] = useState('30');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  // Borrado permanente: modal propio que exige escribir ELIMINAR (los
  // confirm() nativos se aceptan por inercia con doble click).
  const [borrando, setBorrando] = useState<Negocio | null>(null);
  const [textoConfirmar, setTextoConfirmar] = useState('');
  const [cargandoBorrado, setCargandoBorrado] = useState(false);
  // Selección múltiple para acciones bulk.
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cargandoBulk, setCargandoBulk] = useState(false);

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
    if (filter === 'prueba') return infoSuscripcion(n).estado === 'prueba';
    return true;
  });

  const todosMarcados =
    filtered.length > 0 && filtered.every((n) => seleccionados.has(n.id));

  const toggleTodos = () => {
    setSeleccionados(todosMarcados ? new Set() : new Set(filtered.map((n) => n.id)));
  };

  const toggleUno = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const accionBulk = async (accion: 'activar' | 'desactivar' | 'papelera') => {
    if (seleccionados.size === 0) return;
    if (accion === 'papelera' && !confirm(`¿Mover ${seleccionados.size} negocio(s) a la papelera?`)) return;
    setCargandoBulk(true);
    setError('');
    setMensaje('');
    const resultados = await Promise.all(
      [...seleccionados].map((id) =>
        fetch('/api/negocios', {
          method: accion === 'papelera' ? 'DELETE' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            accion === 'papelera'
              ? { id }
              : { id, activo: accion === 'activar' },
          ),
        }),
      ),
    );
    setCargandoBulk(false);
    const fallidos = resultados.filter((r) => !r.ok).length;
    if (fallidos > 0) {
      setError(`${fallidos} de ${seleccionados.size} acciones fallaron.`);
    } else {
      setMensaje(
        accion === 'activar'
          ? `${seleccionados.size} negocio(s) activados.`
          : accion === 'desactivar'
            ? `${seleccionados.size} negocio(s) desactivados.`
            : `${seleccionados.size} negocio(s) movidos a la papelera.`,
      );
      setSeleccionados(new Set());
      router.refresh();
    }
  };

  const cerrarModal = () => {
    setModal(null);
    setSeleccion(null);
    setError('');
  };

  const abrirEditar = (n: Negocio) => {
    setSeleccion(n);
    setPlan(PLANES_VALIDOS.includes(n.plan) ? n.plan : 'pro');
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
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Error al cambiar estado.');
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Mover a la papelera "${nombre}"? Se podrá restaurar después.`)) return;
    const res = await fetch('/api/negocios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Error al mover a papelera.');
    }
  };

  const handleRestaurar = async (id: string) => {
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deleted_at: null }),
    });
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Error al restaurar.');
    }
  };

  const abrirBorradoPermanente = (n: Negocio) => {
    setBorrando(n);
    setTextoConfirmar('');
  };

  const confirmarBorrado = async () => {
    if (!borrando || textoConfirmar !== 'ELIMINAR') return;
    setCargandoBorrado(true);
    const res = await fetch('/api/negocios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: borrando.id, permanente: true }),
    });
    setCargandoBorrado(false);
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || 'Error al eliminar.');
      setBorrando(null);
      return;
    }
    setBorrando(null);
    router.refresh();
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

  const presetFecha = (diasDesdeHoy: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + diasDesdeHoy);
    setExpiracion(d.toISOString().slice(0, 10));
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {mensaje}
        </div>
      )}

      {seleccionados.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-800">
            {seleccionados.size} seleccionado{seleccionados.size === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => accionBulk('activar')}
            disabled={cargandoBulk}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {cargandoBulk ? '...' : '✓ Activar'}
          </button>
          <button
            onClick={() => accionBulk('desactivar')}
            disabled={cargandoBulk}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition"
          >
            {cargandoBulk ? '...' : 'Desactivar'}
          </button>
          <button
            onClick={() => accionBulk('papelera')}
            disabled={cargandoBulk}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
          >
            {cargandoBulk ? '...' : '🗑️ Papelera'}
          </button>
          <button
            onClick={() => setSeleccionados(new Set())}
            disabled={cargandoBulk}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {!filter.includes('papelera') && (
                <th scope="col" className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={toggleTodos}
                    aria-label="Seleccionar todos"
                    className="w-4 h-4 accent-emerald-600"
                  />
                </th>
              )}
              <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Negocio</th>
              <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Plan</th>
              <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
              <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Suscripción</th>
              <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n) => {
              const info = infoSuscripcion(n);
              return (
                <tr key={n.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${seleccionados.has(n.id) ? 'bg-blue-50/50' : ''}`}>
                  {!filter.includes('papelera') && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(n.id)}
                        onChange={() => toggleUno(n.id)}
                        aria-label={`Seleccionar ${n.nombre_negocio}`}
                        className="w-4 h-4 accent-emerald-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{n.nombre_negocio}</td>
                  <td className="px-4 py-3 text-gray-500">{n.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold text-gray-700">
                      {labelPlan(n.plan)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${CLASES_BADGE[info.estado]}`}>
                      {info.etiqueta}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {info.detalle}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {n.deleted_at ? (
                        <>
                          <button
                            onClick={() => handleRestaurar(n.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          >
                            ♻️ Restaurar
                          </button>
                          <button
                            onClick={() => abrirBorradoPermanente(n)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                            title="Eliminar definitivamente todos sus datos"
                            aria-label={`Eliminar permanentemente ${n.nombre_negocio}`}
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
                          <BackupButton negocioId={n.id} negocioNombre={n.nombre_negocio} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron negocios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginacion && paginacion.totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          {(() => {
            const buildHref = (page: number) => {
              const params = new URLSearchParams();
              params.set('page', String(page));
              if (paginacion.q) params.set('q', paginacion.q);
              if (paginacion.plan && paginacion.plan !== 'todos') params.set('plan', paginacion.plan);
              if (paginacion.estado && paginacion.estado !== 'todos') params.set('estado', paginacion.estado);
              if (paginacion.expiran && paginacion.expiran !== 'todos') params.set('expiran', paginacion.expiran);
              return `/dashboard/negocios?${params.toString()}`;
            };
            return (
              <>
                {paginacion.pagina > 1 ? (
                  <a
                    href={buildHref(paginacion.pagina - 1)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    ← Anterior
                  </a>
                ) : (
                  <span />
                )}
                <span className="text-sm text-gray-500">
                  Página {paginacion.pagina} de {paginacion.totalPaginas}
                </span>
                {paginacion.pagina < paginacion.totalPaginas ? (
                  <a
                    href={buildHref(paginacion.pagina + 1)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Siguiente →
                  </a>
                ) : (
                  <span />
                )}
              </>
            );
          })()}
        </div>
      )}

      {modal && seleccion && (
        <Modal
          etiqueta={modal === 'editar' ? 'Editar negocio' : 'Renovar suscripción'}
          onClose={cerrarModal}
        >
          <>
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
                  <label htmlFor="modal-plan" className="block text-sm font-medium text-gray-600 mb-1">Plan</label>
                  <select
                    id="modal-plan"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  >
                    {PLANES_VALIDOS.map((p) => (
                      <option key={p} value={p}>
                        {DESCRIPCION_PLAN[p]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Para dar una prueba: no toques el plan, solo deja "Desactivado" y
                    pon la fecha de expiración 15 días adelante.
                  </p>
                </div>
                <div>
                  <label htmlFor="modal-expiracion" className="block text-sm font-medium text-gray-600 mb-1">
                    Fecha de expiración <span className="text-gray-500">(dejar vacío para no cambiar)</span>
                  </label>
                  <input
                    id="modal-expiracion"
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={expiracion}
                    onChange={(e) => setExpiracion(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => presetFecha(15)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      Hoy + 15 días
                    </button>
                    <button
                      type="button"
                      onClick={() => presetFecha(30)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      Hoy + 30 días
                    </button>
                    <button
                      type="button"
                      onClick={() => presetFecha(90)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      Hoy + 90 días
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="modal-dias" className="block text-sm font-medium text-gray-600 mb-1">
                  Días de renovación
                </label>
                <input
                  id="modal-dias"
                  type="number"
                  min={1}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">
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
          </>
        </Modal>
      )}

      {borrando && (
        <Modal etiqueta="Confirmar borrado permanente" onClose={() => setBorrando(null)}>
          <>
            <h3 className="text-lg font-bold text-red-700 mb-1">
              ⚠️ Borrado definitivo
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Vas a eliminar <strong>{borrando.nombre_negocio}</strong> ({borrando.email}) para
              siempre. Se borrarán TODOS sus datos: ventas, gastos, catálogo, compras y pagos.
              <strong> No se podrá recuperar nada.</strong>
            </p>
            <label htmlFor="confirmar-borrar" className="block text-sm font-medium text-gray-700 mb-1">
              Escribe <span className="font-mono font-bold text-red-600">ELIMINAR</span> para confirmar:
            </label>
            <input
              id="confirmar-borrar"
              type="text"
              value={textoConfirmar}
              onChange={(e) => setTextoConfirmar(e.target.value)}
              placeholder="ELIMINAR"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-mono"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setBorrando(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                disabled={textoConfirmar !== 'ELIMINAR' || cargandoBorrado}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition text-sm font-semibold"
              >
                {cargandoBorrado ? 'Eliminando...' : 'Eliminar para siempre'}
              </button>
            </div>
          </>
        </Modal>
      )}
    </div>
  );
}
