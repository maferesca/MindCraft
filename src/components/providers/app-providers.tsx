"use client";

import { useEffect, type ReactNode } from "react";
import { BrandMark } from "../brand/brand-mark";
import { TooltipProvider } from "../ui/icon-button";
import { NotificationsProvider } from "../ui/notifications";
import { TimerProvider } from "./timer";
import { WorkspaceDataProvider, useWorkspaceData } from "./workspace-data";
import { WorkspaceUIProvider } from "./workspace-ui";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <TooltipProvider>
        <WorkspaceDataProvider>
          <DataGate>
            <TimerProvider>
              <WorkspaceUIProvider>{children}</WorkspaceUIProvider>
            </TimerProvider>
          </DataGate>
        </WorkspaceDataProvider>
      </TooltipProvider>
    </NotificationsProvider>
  );
}

function DataGate({ children }: { children: ReactNode }) {
  const { status, loadError } = useWorkspaceData();

  useEffect(() => {
    if (status === "signed_out") window.location.replace("/sign-in");
  }, [status]);

  if (status === "ready") return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandMark size={40} />
      {status === "error" ? (
        <div role="alert" className="max-w-md">
          <p className="text-lg font-semibold">Your workspace couldn&apos;t load.</p>
          <p className="mc-hint mt-1">{navigator.onLine ? "Please try again in a moment." : "You appear to be offline."}</p>
          {loadError ? <p className="mc-hint mt-1 text-sm">Details: {loadError}</p> : null}
          <button type="button" className="mc-btn mc-btn-primary mt-4" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        <p role="status" className="text-text-muted">
          Opening your workspace…
        </p>
      )}
    </div>
  );
}
