// Mindcraft mark: three placed tiles and one open slot. Decorative only.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="12" height="12" rx="3" fill="var(--mc-primary)" />
      <rect x="17" y="3" width="12" height="12" rx="3" fill="var(--mc-secondary)" />
      <rect x="3" y="17" width="12" height="12" rx="3" fill="var(--mc-cube-c)" />
      <rect x="18" y="18" width="10" height="10" rx="2.5" fill="none" stroke="var(--mc-primary)" strokeWidth="1.6" strokeDasharray="3 2" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <BrandMark size={26} />
      <span>Mindcraft</span>
    </span>
  );
}
