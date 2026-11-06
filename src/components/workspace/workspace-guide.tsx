"use client";

import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";

const STEPS = [
  { title: "Turn on Creative Mode", text: "Press Creative Mode at the top of the screen. Nothing changes until you save." },
  { title: "Open the inventory", text: "Press Open inventory at the bottom of the screen to see every block, what it does, and an example." },
  { title: "Add blocks", text: "Press a block to add it, or drag it onto the grid on a larger screen." },
  { title: "Move or resize", text: "Drag a block by its header, or drag its corner to resize it. The arrows and the three-dot menu do the same without dragging." },
  { title: "Save your workspace", text: "Press Save layout to keep your changes. Cancel puts everything back." },
] as const;

// Optional and inline, so it never covers the workspace. It starts as one line, and
// it can be reopened from Settings or from Creative Mode.
export function WorkspaceGuide() {
  const { preferences, updatePreferences } = useWorkspaceData();
  const { guideStep, setGuideStep, creativeMode, setCreativeMode } = useWorkspaceUI();

  function skip() {
    setGuideStep(null);
    if (!preferences.workspaceGuideSeen) updatePreferences({ workspaceGuideSeen: true });
  }

  if (guideStep === null) {
    if (preferences.workspaceGuideSeen || creativeMode) return null;
    return (
      <aside aria-label="Workspace guide" className="mc-card mb-4 flex flex-wrap items-center gap-2 px-4 py-2">
        <p className="mr-auto">New here? See how to arrange your workspace in five short steps.</p>
        <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setGuideStep(0)}>
          Show me
        </button>
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={skip}>
          Skip
        </button>
      </aside>
    );
  }

  const step = STEPS[guideStep];
  const last = guideStep === STEPS.length - 1;
  return (
    <aside aria-label="Workspace guide" className="mc-card mb-4 px-4 py-3">
      <p className="mc-hint" aria-live="polite">
        Step {guideStep + 1} of {STEPS.length}
      </p>
      <h2 className="font-bold">{step.title}</h2>
      <p>{step.text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {guideStep === 0 && !creativeMode ? (
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setCreativeMode(true)}>
            Turn on Creative Mode
          </button>
        ) : null}
        {guideStep > 0 ? (
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setGuideStep(guideStep - 1)}>
            Back
          </button>
        ) : null}
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={() => (last ? skip() : setGuideStep(guideStep + 1))}>
          {last ? "Finish" : "Next"}
        </button>
        {last ? null : (
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={skip}>
            Skip
          </button>
        )}
      </div>
    </aside>
  );
}
