"use client";

import { DropdownMenu, Popover } from "radix-ui";
import { Bell, Blocks, CalendarCheck, Flame, Focus, LogOut, Palette, Shield, SlidersHorizontal, Star, User, UserCog } from "lucide-react";
import { STREAK_STAGES, streakStage } from "@/lib/streak";
import { THEMES } from "@/lib/themes";
import { BrandMark, Wordmark } from "../brand/brand-mark";
import { TeamCredit } from "../brand/team-credit";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI, type SettingsSection } from "../providers/workspace-ui";
import { ProgressIndicator } from "./progress-indicator";

const MENU_ITEMS: Array<{ section: SettingsSection; label: string; icon: typeof User }> = [
  { section: "profile", label: "Profile", icon: User },
  { section: "appearance", label: "Appearance and reading", icon: Palette },
  { section: "workspace", label: "Workspace preferences", icon: SlidersHorizontal },
  { section: "notifications", label: "Notifications", icon: Bell },
  { section: "rewards", label: "Motivation & Rewards", icon: Star },
  { section: "ai", label: "AI and privacy", icon: Shield },
  { section: "account", label: "Account", icon: UserCog },
];

// Compact header: profile and name on the left, the three modes on the right.
// No sidebar and no tab bar.
export function AppHeader() {
  const { profile, workspace, signOut, mode } = useWorkspaceData();
  const { openSettings, openPlanning, focusMode, enterFocus, exitFocus, creativeMode, setCreativeMode } = useWorkspaceUI();
  const initial = (profile?.display_name || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur" style={{ height: "var(--header-height)" }}>
      <div className="mx-auto flex h-full max-w-[1400px] items-center gap-2 px-4">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-primary-soft text-lg font-bold"
            aria-label="Open profile menu"
            title="Profile and settings"
          >
            {initial === "?" ? <User size={20} aria-hidden="true" /> : initial}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="mc-menu" align="start" sideOffset={6}>
              <DropdownMenu.Label className="px-2 py-1">
                <span className="block font-semibold">{profile?.display_name || "Your profile"}</span>
                {mode === "demo" ? <span className="mc-hint">Local demo (this browser only)</span> : null}
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              {MENU_ITEMS.map(({ section, label, icon: Icon }) => (
                <DropdownMenu.Item key={section} className="mc-menu-item" onSelect={() => openSettings(section)}>
                  <Icon size={16} aria-hidden="true" /> {label}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item className="mc-menu-item" onSelect={() => signOut()}>
                <LogOut size={16} aria-hidden="true" /> {mode === "demo" ? "Leave demo" : "Sign out"}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Label className="px-2 py-1">
                <TeamCredit />
              </DropdownMenu.Label>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden sm:inline-flex">
            <Wordmark className="text-xl" markSize={36} />
          </span>
          <span className="sm:hidden">
            <BrandMark size={34} />
          </span>
          <span className="hidden text-text-muted sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="truncate font-semibold">{workspace?.name ?? "My workspace"}</h1>
          <StreakIndicator />
          <ProgressIndicator />
        </div>

        <nav aria-label="Modes" className="ml-auto flex items-center gap-1">
          <HeaderButton label="Plan my day" icon={<CalendarCheck size={18} aria-hidden="true" />} onClick={() => openPlanning()} />
          <HeaderButton
            label={focusMode ? "Exit Focus" : "Focus Mode"}
            icon={<Focus size={18} aria-hidden="true" />}
            pressed={focusMode}
            onClick={() => (focusMode ? exitFocus() : enterFocus())}
          />
          <HeaderButton
            label="Creative Mode"
            icon={<Blocks size={18} aria-hidden="true" />}
            pressed={creativeMode}
            onClick={() => setCreativeMode(!creativeMode)}
          />
        </nav>
      </div>
    </header>
  );
}

function HeaderButton({ label, icon, onClick, pressed }: { label: string; icon: React.ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={label}
      className={`mc-btn mc-btn-sm min-h-11 shrink-0 px-2.5 md:px-3 ${pressed ? "mc-btn-primary" : "mc-btn-ghost"}`}
    >
      {icon}
      {/* Visible label on wide screens; otherwise the button keeps its accessible name and tooltip. */}
      <span className="whitespace-nowrap max-xl:sr-only">{label}</span>
    </button>
  );
}

function StreakIndicator() {
  const { streak, preferences, updatePreferences } = useWorkspaceData();
  if (!preferences.showStreak || !streak || streak.current_streak < 1) return null;
  const { stage, next } = streakStage(streak.current_streak);
  const tone = THEMES[preferences.theme].dark ? "dark" : "light";
  // The monochrome theme has no color by design, so the flame follows its text.
  const colorOf = (item: (typeof STREAK_STAGES)[number]) => (preferences.theme === "monochrome" ? "currentColor" : item[tone]);
  return (
    <Popover.Root>
      <Popover.Trigger className="mc-chip ml-1 shrink-0 cursor-pointer bg-surface" aria-label={`Visit streak: ${streak.current_streak} ${streak.current_streak === 1 ? "day" : "days"}. Show details`}>
        <Flame size={14} aria-hidden="true" fill="currentColor" className="shrink-0" style={{ color: colorOf(stage) }} />
        <span className="max-sm:sr-only">{streak.current_streak} day{streak.current_streak === 1 ? "" : "s"}</span>
        <span className="sm:hidden">{streak.current_streak}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="mc-menu max-w-xs p-3" sideOffset={6}>
          <p className="font-semibold">Visit streak: {streak.current_streak}</p>
          <p className="mc-hint mt-1">
            Days in a row you opened MindCraft. Best: {streak.best_streak}.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Flame colors by days in a row">
            {STREAK_STAGES.map((item) => (
              <li key={item.days} className={`inline-flex items-center gap-1 rounded-full px-1.5 text-sm ${item === stage ? "bg-surface-muted font-bold" : ""}`}>
                <Flame size={14} aria-hidden="true" fill="currentColor" style={{ color: colorOf(item) }} />
                {item.days}
                <span className="sr-only">
                  {" "}
                  days: {item.name}
                  {item === stage ? " (current)" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mc-hint mt-1">{next ? `The flame changes color at ${next.days} days.` : "You've reached the last flame color."}</p>
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm mt-2" onClick={() => updatePreferences({ showStreak: false })}>
            Hide streak
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
