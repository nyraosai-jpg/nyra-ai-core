/** Nothing that changes your calendar or your home happens without this card. */
export function ConfirmCard({
  summary,
  onConfirm,
  onCancel,
}: {
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-primary/40 bg-nyra-panel p-4 shadow-lg">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Permission needed
      </p>
      <p className="mt-2 text-sm text-foreground">{summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Nothing changes until you approve. You can also just say “yes” or “no”.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-10 flex-1 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 flex-1 rounded-full border border-border/60 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
