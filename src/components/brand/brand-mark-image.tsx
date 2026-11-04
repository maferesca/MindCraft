import { BRAND_COLORS, BRAND_FACES, BRAND_VIEW_BOX } from "./brand-geometry";

// Generated PNG icons (next/og). These are fixed images, so they use the approved
// colors. Pass a background only where the platform needs an opaque icon.
export function BrandMarkImage({ size, background, scale = 0.92 }: { size: number; background?: string; scale?: number }) {
  const icon = Math.round(size * scale);
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: background ?? "transparent" }}>
      <svg width={icon} height={icon} viewBox={BRAND_VIEW_BOX}>
        <polygon points={BRAND_FACES.top} fill={BRAND_COLORS.top} />
        <polygon points={BRAND_FACES.left} fill={BRAND_COLORS.left} />
        <polygon points={BRAND_FACES.rightUpper} fill={BRAND_COLORS.right} />
        <polygon points={BRAND_FACES.rightLower} fill={BRAND_COLORS.right} />
      </svg>
    </div>
  );
}
