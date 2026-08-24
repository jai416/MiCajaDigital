'use client';

import { useEffect, useState } from 'react';
import precios from '@config/precios.json';
import { fechaCorta, fechaHora } from '@/lib/formato';

interface Codigo {
  id: string;
  codigo: string;
  email: string;
  plan: string;
  duracion_meses: number;
  precio_pagado: number;
  metodo_pago: string;
  fecha_expiracion: string;
  usado: boolean;
  usado_en: string | null;
  usado_por: string | null;
  created_at: string;
}

// Precios FIJOS por plan/duración, fuente de verdad: config/precios.json
// (raíz del repo). NO derivarlos con *0.9 / *0.8333: redondeos divergen
// (24999 vs 25000). Los valida la app en test/suscripcion_test.dart.
const PLANES: { id: string; precio: Record<string, number> }[] =
  Object.entries(precios.planes).map(([id, precio]) => ({ id, precio }));
const DURACIONES = [
  { id: 1, label: '1 mes' },
  { id: 3, label: '3 meses (-10%)' },
  { id: 12, label: '12 meses (-17%)' },
];

export default function CodigosPage() {
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('pro');
  const [duracion, setDuracion] = useState(1);
  const [metodo, setMetodo] = useState('transfermovil');
  const [generado, setGenerado] = useState<Codigo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [cargado, setCargado] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  // Feedback del botón Copiar (y fallback si clipboard API falla).
  const [copiado, setCopiado] = useState('');

  const planSel = PLANES.find((p) => p.id === plan)!;
  const durSel = DURACIONES.find((d) => d.id === duracion)!;
  const precio = planSel.precio[String(duracion)];

  const estadoDe = (c: Codigo): 'usado' | 'vencido' | 'disponible' =>
    c.usado ? 'usado' : new Date(c.fecha_expiracion).getTime() < Date.now() ? 'vencido' : 'disponible';

  const visibles = codigos.filter((c) =>
    filtro === 'todos' || estadoDe(c) === filtro
  );

  const descargarCSV = () => {
    if (visibles.length === 0) return;
    const cabecera = 'codigo,email,plan,duracion_meses,precio_pagado,metodo_pago,usado,usado_en,vencimiento,creado';
    const filas = visibles.map((c) =>
      [
        c.codigo, c.email, c.plan, c.duracion_meses, c.precio_pagado,
        c.metodo_pago, c.usado ? 'si' : 'no', c.usado_en ?? '',
        c.fecha_expiracion, c.created_at,
      ]
        .map((v) => {
          let s = String(v).replaceAll('"', '""');
          // Neutraliza inyección de fórmulas en Excel/Sheets (= + - @ al
          // inicio de la celda se ejecutan al abrir el CSV).
          if (/^[=+\-@]/.test(s)) s = `'${s}`;
          return `"${s}"`;
        })
        .join(',')
    );
    const blob = new Blob([[cabecera, ...filas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cargar = async (paginaNueva: number = 1) => {
    try {
      const res = await fetch(`/api/codigos?pagina=${paginaNueva}&porPagina=50`);
      const json = await res.json();
      if (res.ok) {
        setCodigos(json.data ?? []);
        setPagina(json.pagina ?? 1);
        setTotalPaginas(json.totalPaginas ?? 1);
        setTotal(json.total ?? 0);
      }
    } catch {
      // sin red: se mantiene la lista previa
    }
    setCargado(true);
  };

  useEffect(() => {
    cargar();
  }, []);

  const generar = async () => {
    if (!email.trim()) {
      setError('Introduce el correo de la clienta.');
      return;
    }
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          plan,
          duracion_meses: duracion,
          metodo_pago: metodo,
        }),
      });
      const json = await res.json();
      setCargando(false);
      if (!res.ok) {
        setError(json.error || 'Error al generar el código.');
        return;
      }
      setGenerado(json.data);
      setEmail('');
      await cargar(1);
    } catch {
      setCargando(false);
      setError('Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.');
    }
  };

  const copiar = async (texto: string) => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback (contexto no seguro / permiso denegado)
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }
    if (ok) {
      setCopiado(texto);
      setTimeout(() => setCopiado(''), 2000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Códigos de pago</h1>
        <span className="text-sm text-gray-500">{total} generados</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Generar código</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="codigo-email" className="block text-sm font-medium text-gray-600 mb-1">Correo de la clienta</label>
              <input
                id="codigo-email"
                type="email"
                placeholder="cliente@correo.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="codigo-plan" className="block text-sm font-medium text-gray-600 mb-1">Plan</label>
              <select
                id="codigo-plan"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                {PLANES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === 'basico' ? 'Básico' : p.id === 'pro' ? 'Pro' : 'Premium'} — {p.precio[1]} CUP/mes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="codigo-duracion" className="block text-sm font-medium text-gray-600 mb-1">Duración</label>
              <select
                id="codigo-duracion"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
              >
                {DURACIONES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="codigo-metodo" className="block text-sm font-medium text-gray-600 mb-1">Método de pago</label>
              <select
                id="codigo-metodo"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
              >
                <option value="transfermovil">Transfermóvil</option>
                <option value="efectivo">Efectivo</option>
                <option value="usdt">USDT (Binance)</option>
              </select>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-emerald-700">
                Total: {precio.toLocaleString()} CUP
              </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={generar}
              disabled={cargando}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold transition"
            >
              {cargando ? 'Generando...' : 'Generar código'}
            </button>
          </div>

          {generado && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Código generado</p>
              <p className="text-3xl font-black text-blue-900 my-2 tracking-[0.3em]">{generado.codigo}</p>
              <p className="text-sm text-blue-700">
                {generado.plan === 'basico' ? 'Básico' : generado.plan === 'premium' ? 'Premium' : 'Pro'} ·{' '}
                {DURACIONES.find((d) => d.id === generado.duracion_meses)?.label} ·{' '}
                {generado.precio_pagado.toLocaleString()} CUP
              </p>
              <p className="text-xs text-blue-600 mt-1">{generado.email}</p>
              <div className="flex justify-center gap-2 mt-3">
                <button
                  onClick={() => copiar(generado.codigo)}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {copiado === generado.codigo ? '✓ Copiado' : 'Copiar'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Mi Caja Digital — Código de activación: ${generado.codigo} (plan ${generado.plan === 'basico' ? 'Básico' : generado.plan === 'premium' ? 'Premium' : 'Pro'}, ${generado.precio_pagado.toLocaleString()} CUP). Canjéalo en Ajustes → Suscripción.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Enviar por WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex gap-2">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'disponibles', label: 'Disponibles' },
                { id: 'usados', label: 'Usados' },
                { id: 'vencidos', label: 'Vencidos' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    filtro === f.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={descargarCSV}
              disabled={visibles.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
            >
              ⬇ Exportar CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Plan</th>
                <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Meses</th>
                <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Precio</th>
                <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Creado</th>
                <th scope="col" className="text-center px-4 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono font-bold">{c.codigo}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3 text-center capitalize">{c.plan}</td>
                  <td className="px-4 py-3 text-center">{c.duracion_meses}</td>
                  <td className="px-4 py-3 text-center">{c.precio_pagado.toLocaleString()} CUP</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        c.usado
                          ? 'bg-gray-100 text-gray-500'
                          : new Date(c.fecha_expiracion).getTime() < Date.now()
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {c.usado ? 'Usado' : new Date(c.fecha_expiracion).getTime() < Date.now() ? 'Vencido' : 'Disponible'}
                    </span>
                    {c.usado && c.usado_en && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        el {fechaHora(c.usado_en)}
                      </p>
                    )}
                    {!c.usado && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        vence el {fechaCorta(c.fecha_expiracion)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {fechaCorta(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!c.usado && (
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Mi Caja Digital — Código de activación: ${c.codigo} (plan ${c.plan === 'basico' ? 'Básico' : c.plan === 'premium' ? 'Premium' : 'Pro'}, ${c.precio_pagado.toLocaleString()} CUP). Canjéalo en Ajustes → Suscripción.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
                      >
                        Enviar
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No hay códigos en este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => cargar(pagina - 1)}
                disabled={pagina <= 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Anterior
              </button>
              <span className="text-xs text-gray-500">
                Página {pagina} de {totalPaginas} · el CSV exporta esta página
              </span>
              <button
                onClick={() => cargar(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}