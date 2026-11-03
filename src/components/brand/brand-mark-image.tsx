// Brand mark for generated PNG icons (rendered by next/og, which needs flexbox).
// Three filled tiles and one open slot: a space you fill in yourself.
export function BrandMarkImage({ size }: { size: number }) {
  const tile = Math.round(size * 0.3);
  const gap = Math.round(size * 0.06);
  const radius = Math.round(size * 0.07);
  const tileStyle = (color: string) => ({ width: tile, height: tile, borderRadius: radius, background: color });
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F2EA" }}>
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        <div style={{ display: "flex", gap }}>
          <div style={tileStyle("#8F432F")} />
          <div style={tileStyle("#586B50")} />
        </div>
        <div style={{ display: "flex", gap }}>
          <div style={tileStyle("#E3B66B")} />
          <div style={{ ...tileStyle("transparent"), border: `${Math.max(2, Math.round(size * 0.025))}px dashed #8F432F` }} />
        </div>
      </div>
    </div>
  );
}
