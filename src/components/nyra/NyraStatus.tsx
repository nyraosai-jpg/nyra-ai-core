export function NyraStatus({ label, detail }: { label: string; detail?: string | undefined }) {
  return (
    <div className="text-center" role="status" aria-live="polite">
      <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      {detail ? <p className="mt-2 text-sm text-foreground/80">{detail}</p> : null}
    </div>
  );
}
