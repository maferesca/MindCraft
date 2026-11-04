"use client";

import { useState } from "react";
import { startDemo } from "@/lib/data/local-repository";
import { isDemoEnabled } from "@/lib/supabase/config";

// Local demo: fictional data stored only in this browser. No account needed.
export function DemoEntry() {
  const [withSamples, setWithSamples] = useState(true);
  if (!isDemoEnabled) return null;
  return (
    <section aria-labelledby="demo-heading" className="mc-card p-4 text-left">
      <h2 id="demo-heading" className="font-bold">
        Try MindCraft without an account
      </h2>
      <p className="mc-hint mt-1">
        Data stays in this browser.
      </p>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={withSamples} onChange={(event) => setWithSamples(event.target.checked)} />
        Include fictional sample tasks and notes
      </label>
      <button
        type="button"
        className="mc-btn mc-btn-secondary mt-3 w-full"
        onClick={() => {
          startDemo(withSamples);
          // Full page load so the session cookie and workspace data are read fresh.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/welcome");
        }}
      >
        Open the local demo
      </button>
    </section>
  );
}
