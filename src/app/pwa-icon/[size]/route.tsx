import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/components/brand/brand-mark-image";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_request: Request, context: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await context.params;
  const pixels = size === "192" ? 192 : 512;
  // Maskable icons need a solid background and room for the platform's crop.
  const icon = size === "maskable" ? <BrandMarkImage size={pixels} background="#FFFFFF" scale={0.62} /> : <BrandMarkImage size={pixels} />;
  return new ImageResponse(icon, { width: pixels, height: pixels });
}
