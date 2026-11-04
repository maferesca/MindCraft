import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Comic_Neue, Lexend, Open_Sans } from "next/font/google";
import localFont from "next/font/local";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "@/lib/appearance-cache";
import "./globals.css";

const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], display: "swap" });

// Lexend is the default and brand font. The other reading fonts load only when selected.
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], display: "swap" });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const comicNeue = Comic_Neue({ variable: "--font-comic-neue", subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const openDyslexic = localFont({
  variable: "--font-opendyslexic",
  display: "swap",
  preload: false,
  src: [
    { path: "../../node_modules/@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "MindCraft", template: "%s · MindCraft" },
  description: "A personal workspace you build your way: tasks, calendar, notes, timer, and practical help starting.",
  applicationName: "MindCraft",
  appleWebApp: { capable: true, title: "MindCraft", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F8F3EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={[openSans, lexend, atkinson, comicNeue, openDyslexic].map((font) => font.variable).join(" ")} suppressHydrationWarning>
      <head>
        {/* Applies saved appearance before first paint to avoid a theme flash. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
