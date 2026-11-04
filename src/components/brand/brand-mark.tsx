import { BRAND_FACES, BRAND_VIEW_BOX } from "./brand-geometry";

// Face shades derive from the active palette, always lit from the upper left:
// lightest on top, medium on the left, darkest on the right.
const TOP_FACE = "color-mix(in srgb, var(--mc-primary) 45%, white)";
const LEFT_FACE = "var(--mc-primary)";
const RIGHT_FACE = "color-mix(in srgb, var(--mc-primary) 62%, black)";

// MindCraft icon. Decorative, so the name is written next to it or set by the parent.
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={BRAND_VIEW_BOX} aria-hidden="true" focusable="false" className="shrink-0">
      <polygon points={BRAND_FACES.top} fill={TOP_FACE} />
      <polygon points={BRAND_FACES.left} fill={LEFT_FACE} />
      <polygon points={BRAND_FACES.rightUpper} fill={RIGHT_FACE} />
      <polygon points={BRAND_FACES.rightLower} fill={RIGHT_FACE} />
    </svg>
  );
}

// The name always uses the brand font, whatever reading font someone picks.
export function Wordmark({ className = "", markSize = 40 }: { className?: string; markSize?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`} style={{ fontFamily: "var(--font-lexend), system-ui, sans-serif" }}>
      <BrandMark size={markSize} />
      <span>MindCraft</span>
    </span>
  );
}
