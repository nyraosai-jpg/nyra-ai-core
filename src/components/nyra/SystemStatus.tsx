import { cn } from "@/lib/utils";

export function StatusPill({
  label,
  ok,
  okText,
  offText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  offText: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-nyra-panel px-3 py-1.5 text-xs text-muted-foreground">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-primary" : "bg-destructive/80")}
        aria-hidden="true"
      />
      <span className="text-foreground/80">{label}</span>
      <span>{ok ? okText : offText}</span>
    </span>
  );
}
