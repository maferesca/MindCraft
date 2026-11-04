import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/components/brand/brand-mark-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandMarkImage size={180} background="#FFFFFF" scale={0.76} />, size);
}
