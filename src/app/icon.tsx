import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/components/brand/brand-mark-image";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandMarkImage size={64} />, size);
}
