// Quiet team signature. The rules on each side are decorative and stay hidden
// from screen readers, which read the credit as one short sentence.
export function TeamCredit({ decorated = false, className = "" }: { decorated?: boolean; className?: string }) {
  const rule = decorated ? <span aria-hidden="true" className="h-px w-8 bg-border-strong" /> : null;
  return (
    <p className={`flex items-center gap-2.5 text-xs text-text-muted ${className}`}>
      {rule}
      <span>
        by <span className="font-semibold tracking-wide text-text">Tec it Easy</span>
      </span>
      {rule}
    </p>
  );
}
