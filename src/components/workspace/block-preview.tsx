// Small schematic of each block, drawn with theme colors. Decorative only:
// the card's name and description carry the meaning.
export function BlockPreview({ id }: { id: string }) {
  return (
    <div aria-hidden="true" className="flex h-16 flex-col justify-center gap-1 overflow-hidden rounded-lg border border-border bg-background p-2">
      {PREVIEWS[id] ?? null}
    </div>
  );
}

function Bar({ width, strong }: { width: string; strong?: boolean }) {
  return <span className={`block h-1.5 rounded-full ${strong ? "bg-primary" : "bg-border-strong opacity-60"}`} style={{ width }} />;
}

function CheckRow({ width, done }: { width: string; done?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border border-border-strong ${done ? "bg-primary" : ""}`} />
      <Bar width={width} />
    </span>
  );
}

const PREVIEWS: Record<string, React.ReactNode> = {
  tasks: (
    <>
      <CheckRow width="70%" done />
      <CheckRow width="85%" />
      <CheckRow width="55%" />
    </>
  ),
  calendar: (
    <span className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: 21 }).map((_, index) => (
        <span key={index} className={`h-3 rounded-[2px] ${index === 9 ? "bg-primary" : "bg-surface-muted"}`} />
      ))}
    </span>
  ),
  "task-guide": (
    <>
      <Bar width="40%" />
      <span className="rounded bg-primary-soft p-1.5">
        <Bar width="80%" strong />
      </span>
    </>
  ),
  "focus-timer": (
    <>
      <span className="text-center text-sm font-bold tabular-nums leading-none">25:00</span>
      <span className="block h-1 overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full w-2/5 bg-secondary" />
      </span>
    </>
  ),
  notes: (
    <>
      <Bar width="45%" strong />
      <Bar width="90%" />
      <Bar width="75%" />
    </>
  ),
  resources: (
    <>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 shrink-0 rounded-sm bg-surface-muted" />
        <Bar width="70%" />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 shrink-0 rounded-sm bg-surface-muted" />
        <Bar width="50%" />
      </span>
    </>
  ),
  "check-in": (
    <>
      <span className="w-4/5 rounded bg-surface-muted p-1">
        <Bar width="80%" />
      </span>
      <span className="ml-auto w-3/5 rounded bg-primary-soft p-1">
        <Bar width="70%" strong />
      </span>
    </>
  ),
};
