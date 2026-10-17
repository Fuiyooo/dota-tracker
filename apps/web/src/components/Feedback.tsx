export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="mt-3 text-sm text-slate-400">{label}</p>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className="mt-3 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
      {message}
    </p>
  );
}
