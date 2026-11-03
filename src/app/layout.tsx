import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "@/lib/appearance-cache";
import "./globals.css";

const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Mindcraft", template: "%s · Mindcraft" },
  description: "A personal workspace you build your way: tasks, calendar, notes, timer, and practical help starting.",
  applicationName: "Mindcraft",
  appleWebApp: { capable: true, title: "Mindcraft", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F7F2EA",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={openSans.variable} suppressHydrationWarning>
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
