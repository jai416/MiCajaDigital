'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <p className="text-lg font-semibold text-red-600">
        Algo falló al cargar esta sección.
      </p>
      <p className="max-w-md text-sm text-gray-500">
        {error.message || 'Error desconocido'}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Reintentar
      </button>
    </div>
  );
}
