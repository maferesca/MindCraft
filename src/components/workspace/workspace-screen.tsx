"use client";

import { useEffect } from "react";
import { AssistantButton, AssistantPanel } from "../assistant/assistant-panel";
import { FocusMode } from "../focus/focus-mode";
import { DailyWelcomeCard } from "../planning/daily-welcome-card";
import { PlanningDialog } from "../planning/planning-dialog";
import { AppProviders } from "../providers/app-providers";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { SettingsDialog } from "../settings/settings-dialog";
import { AppHeader } from "../shell/app-header";
import { OfflineBanner } from "../shell/offline-banner";
import { ReminderBanner } from "../shell/reminder-banner";
import { MissingInfoDialog } from "../tasks/missing-info-dialog";
import { TaskEditorDialog } from "../tasks/task-editor-dialog";
import { SearchDialog } from "./search-dialog";
import { WorkspaceView } from "./workspace-view";

export function WorkspaceScreen() {
  return (
    <AppProviders>
      <WorkspaceLayout />
    </AppProviders>
  );
}

function WorkspaceLayout() {
  const { profile } = useWorkspaceData();
  const { focusMode, creativeMode } = useWorkspaceUI();

  // First access: offer the short setup. "Set this up later" marks it done.
  useEffect(() => {
    if (profile && !profile.onboarding_completed) window.location.replace("/welcome");
  }, [profile]);

  return (
    <>
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[100] rounded-lg bg-surface px-3 py-2 font-semibold">
        Skip to workspace
      </a>
      <OfflineBanner />
      <AppHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 outline-none">
        {focusMode ? (
          <FocusMode />
        ) : (
          <>
            {!creativeMode ? (
              <>
                <ReminderBanner />
                <DailyWelcomeCard />
              </>
            ) : null}
            <WorkspaceView />
          </>
        )}
      </main>
      <AssistantButton />
      <AssistantPanel />
      <PlanningDialog />
      <SettingsDialog />
      <TaskEditorDialog />
      <MissingInfoDialog />
      <SearchDialog />
    </>
  );
}
