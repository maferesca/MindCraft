import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "../brand/brand-mark";

export function AuthShell({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 rounded-md text-xl" aria-label="Mindcraft home">
        <Wordmark />
      </Link>
      <main className="mc-card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {intro ? <div className="mc-hint mt-1 text-base">{intro}</div> : null}
        <div className="mt-6">{children}</div>
      </main>
      {footer ? <div className="mt-6 max-w-md text-center">{footer}</div> : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border-2 px-3 py-2 ${tone === "error" ? "border-danger text-danger" : "border-secondary text-text"}`}
    >
      {children}
    </div>
  );
}
