import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/components/brand/brand-mark-image";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_request: Request, context: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await context.params;
  const pixels = size === "512" ? 512 : 192;
  return new ImageResponse(<BrandMarkImage size={pixels} />, { width: pixels, height: pixels });
}
