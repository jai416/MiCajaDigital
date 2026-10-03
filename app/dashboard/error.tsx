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
      <p className="text-lg font-semibold text-mc-danger">
        Algo falló al cargar esta sección.
      </p>
      <p className="max-w-md text-sm text-mc-muted">
        Ocurrió un error inesperado. Consulta la consola del navegador para más detalles.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-mc-primary px-4 py-2 text-sm font-semibold text-white hover:bg-mc-primary"
      >
        Reintentar
      </button>
    </div>
  );
}
