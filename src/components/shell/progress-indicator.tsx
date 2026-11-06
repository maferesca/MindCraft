"use client";

import { Popover } from "radix-ui";
import { Award, Lock, Star } from "lucide-react";
import { ACHIEVEMENTS, HOW_XP_IS_EARNED, activityLine, levelProgress } from "@/lib/xp";
import type { Achievement } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";

// Personal progress in the header. It shows no ranking or comparison, and every
// color comes from the active theme.
export function ProgressIndicator() {
  const { preferences, progress } = useWorkspaceData();
  if (!preferences.rewardsEnabled) return null;
  const { totalXp, transactions, achievements } = progress;
  const { current, next, percent, toNext } = levelProgress(totalXp);
  const unlocked = new Set(achievements.map((item) => item.achievement));

  return (
    <Popover.Root>
      <Popover.Trigger className="mc-chip ml-1 shrink-0 cursor-pointer bg-surface" aria-label={`Level ${current.level}, ${totalXp} XP. Show progress`}>
        <Star size={14} aria-hidden="true" className="shrink-0 text-primary" fill="currentColor" />
        <span className="max-sm:hidden">
          Level {current.level} · {totalXp} XP
        </span>
        <span className="sm:hidden">{current.level}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="mc-menu w-80 max-w-[calc(100vw-2rem)] p-4" sideOffset={6} collisionPadding={8}>
          <h2 className="font-bold">
            Level {current.level} — {current.name}
          </h2>
          <p className="text-sm">{next ? `${totalXp} / ${next.xp} total XP toward Level ${next.level}` : `${totalXp} total XP`}</p>
          <div
            role="progressbar"
            aria-label={next ? `Progress toward Level ${next.level}` : "Highest level reached"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="mc-hint mt-1">{next ? `${toNext} XP to ${next.name}` : "You've reached the highest level. XP keeps adding up."}</p>

          <h3 className="mt-3 text-sm font-bold">Recent activity</h3>
          {transactions.length ? (
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {transactions.slice(0, 5).map((reward) => (
                <li key={reward.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{activityLine(reward)}</span>
                  <span className="shrink-0 font-semibold">+{reward.amount} XP</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mc-hint">Nothing yet. Rewards appear here as you work.</p>
          )}

          <h3 className="mt-3 text-sm font-bold">Achievements</h3>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {(Object.keys(ACHIEVEMENTS) as Achievement[]).map((id) => (
              <li key={id} className={`flex items-center gap-2 ${unlocked.has(id) ? "font-semibold" : "text-text-muted"}`} title={ACHIEVEMENTS[id].description}>
                {unlocked.has(id) ? <Award size={15} className="shrink-0 text-primary" aria-hidden="true" /> : <Lock size={15} className="shrink-0" aria-hidden="true" />}
                <span>{ACHIEVEMENTS[id].name}</span>
                <span className="sr-only">{unlocked.has(id) ? "(unlocked)" : `(locked: ${ACHIEVEMENTS[id].description})`}</span>
              </li>
            ))}
          </ul>

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-bold">How XP is earned</summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {HOW_XP_IS_EARNED.map(([action, amount]) => (
                <li key={action} className="flex justify-between gap-3">
                  <span>{action}</span>
                  <span className="shrink-0 font-semibold">{amount}</span>
                </li>
              ))}
            </ul>
            <p className="mc-hint mt-1">Each reward counts once, and XP is never taken away.</p>
          </details>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
