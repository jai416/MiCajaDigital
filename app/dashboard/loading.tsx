export default function Loading() {
  return (
    <div
      className="flex h-full items-center justify-center p-10 text-mc-muted"
      role="status"
      aria-live="polite"
    >
      Cargando…
    </div>
  );
}
