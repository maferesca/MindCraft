"use client";

import { Tabs } from "radix-ui";
import { useState } from "react";
import { BLOCK_DEFINITIONS, BLOCK_ORDER } from "@/lib/blocks";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";
import type { BlockType, NotificationPreferences } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI, type SettingsSection } from "../providers/workspace-ui";
import { SelectField, TextField } from "../ui/field";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";
import { AppearanceFields, AppearancePreview, Segmented } from "./appearance-fields";

const SECTIONS: Array<[SettingsSection, string]> = [
  ["profile", "Profile"],
  ["appearance", "Appearance and reading"],
  ["workspace", "Workspace"],
  ["notifications", "Notifications"],
  ["ai", "AI and privacy"],
  ["account", "Account"],
];

// Settings in one dialog with grouped sections (tabs across the top, no sidebar).
export function SettingsDialog() {
  const { settings, openSettings, closeSettings } = useWorkspaceUI();
  return (
    <Modal open={settings !== null} onOpenChange={(open) => !open && closeSettings()} title="Settings" wide>
      <Tabs.Root value={settings ?? "appearance"} onValueChange={(value) => openSettings(value as SettingsSection)}>
        <Tabs.List aria-label="Settings sections" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-border px-1 pb-2">
          {SECTIONS.map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="shrink-0 rounded-lg px-3 py-2 font-semibold text-text-muted data-[state=active]:bg-primary-soft data-[state=active]:text-text data-[state=active]:underline data-[state=active]:underline-offset-4"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="profile">
          <ProfileSection />
        </Tabs.Content>
        <Tabs.Content value="appearance">
          <AppearanceSection />
        </Tabs.Content>
        <Tabs.Content value="workspace">
          <WorkspaceSection />
        </Tabs.Content>
        <Tabs.Content value="notifications">
          <NotificationsSection />
        </Tabs.Content>
        <Tabs.Content value="ai">
          <AiSection />
        </Tabs.Content>
        <Tabs.Content value="account">
          <AccountSection />
        </Tabs.Content>
      </Tabs.Root>
    </Modal>
  );
}

function ProfileSection() {
  const { profile, updateProfile } = useWorkspaceData();
  const { announce } = useNotify();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "UTC");
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await updateProfile({ display_name: name.trim().slice(0, 60) || null, timezone });
        announce("Profile saved.");
      }}
    >
      <TextField label="Display name" optional value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      <SelectField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </SelectField>
      <button type="submit" className="mc-btn mc-btn-primary self-start">
        Save profile
      </button>
    </form>
  );
}

function AppearanceSection() {
  const { preferences, updatePreferences } = useWorkspaceData();
  const appearanceKeys: Array<keyof Preferences> = ["theme", "accent", "fontFamily", "textSize", "lineHeight", "letterSpacing", "wordSpacing", "density", "reducedMotion", "sounds"];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <AppearanceFields value={preferences} onChange={updatePreferences} />
        <button
          type="button"
          className="mc-btn mc-btn-secondary mt-6"
          onClick={() => updatePreferences(Object.fromEntries(appearanceKeys.map((key) => [key, DEFAULT_PREFERENCES[key]])) as Partial<Preferences>)}
        >
          Restore appearance defaults
        </button>
      </div>
      <div className="lg:sticky lg:top-0 lg:self-start">
        <AppearancePreview />
      </div>
    </div>
  );
}

function WorkspaceSection() {
  const { preferences, updatePreferences, workspace, renameWorkspace, resetLayout } = useWorkspaceData();
  const { announce } = useNotify();
  const [name, setName] = useState(workspace?.name ?? "My workspace");
  const toggleTool = (type: BlockType) =>
    updatePreferences({
      preferredTools: preferences.preferredTools.includes(type) ? preferences.preferredTools.filter((item) => item !== type) : [...preferences.preferredTools, type],
    });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          await renameWorkspace(name);
          announce("Workspace renamed.");
        }}
      >
        <div className="min-w-60 flex-1">
          <TextField label="Workspace name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        </div>
        <button type="submit" className="mc-btn mc-btn-primary">
          Rename
        </button>
      </form>

      <fieldset>
        <legend className="mc-label">Preferred tools</legend>
        <p className="mc-hint mb-2">Used to suggest a starter layout.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BLOCK_ORDER.map((type) => (
            <label key={type} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3">
              <input type="checkbox" className="h-5 w-5" checked={preferences.preferredTools.includes(type)} onChange={() => toggleTool(type)} />
              {BLOCK_DEFINITIONS[type].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Focus session length (minutes)"
          type="number"
          min={5}
          max={120}
          value={preferences.workMinutes}
          onChange={(event) => Number(event.target.value) >= 5 && updatePreferences({ workMinutes: Number(event.target.value) })}
        />
        <TextField
          label="Break length (minutes)"
          type="number"
          min={1}
          max={60}
          value={preferences.breakMinutes}
          onChange={(event) => Number(event.target.value) >= 1 && updatePreferences({ breakMinutes: Number(event.target.value) })}
        />
      </div>

      <div>
        <p className="mc-label">Planning style</p>
        <Segmented
          label="Planning style"
          value={preferences.planningStyle}
          options={[["one_step", "One step at a time"], ["short_list", "A short list"], ["full_overview", "The full overview"]]}
          onChange={(value) => updatePreferences({ planningStyle: value as Preferences["planningStyle"] })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={preferences.dailyWelcome} onChange={(event) => updatePreferences({ dailyWelcome: event.target.checked })} />
          Show the daily welcome card
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={preferences.showStreak} onChange={(event) => updatePreferences({ showStreak: event.target.checked })} />
          Show the visit streak in the header
        </label>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-bold">Reset workspace layout</h3>
        <p className="mc-hint mt-1">Your tasks, notes, and events are kept.</p>
        <button
          type="button"
          className="mc-btn mc-btn-danger mt-3"
          onClick={async () => {
            if (!window.confirm("Remove all blocks from your workspace? Your tasks, notes, and events stay saved.")) return;
            await resetLayout();
            announce("Workspace layout reset.");
          }}
        >
          Reset layout
        </button>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { notificationPreferences: prefs, updateNotificationPreferences } = useWorkspaceData();
  if (!prefs) return <p>Notification settings are not available.</p>;
  const update = (patch: Partial<NotificationPreferences>) => updateNotificationPreferences(patch);
  const time = (value: string | null) => (value ? value.slice(0, 5) : "");

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <p className="rounded-xl bg-surface-muted p-3">
        Reminders only appear while Mindcraft is open.
      </p>
      <div>
        <p className="mc-label">Reminder style</p>
        <Segmented
          label="Reminder style"
          value={prefs.style}
          options={[["off", "Off"], ["friendly", "Friendly"], ["playful", "Playful"], ["minimal", "Minimal"]]}
          onChange={(value) => update({ style: value as NotificationPreferences["style"] })}
        />
      </div>
      {prefs.style !== "off" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Preferred time" optional type="time" value={time(prefs.preferred_time)} onChange={(event) => update({ preferred_time: event.target.value || null })} />
            <TextField label="Quiet hours start" optional type="time" value={time(prefs.quiet_hours_start)} onChange={(event) => update({ quiet_hours_start: event.target.value || null })} />
            <TextField label="Quiet hours end" optional type="time" value={time(prefs.quiet_hours_end)} onChange={(event) => update({ quiet_hours_end: event.target.value || null })} />
          </div>
          <SelectField label="Remind me after I've been away for" value={String(prefs.inactivity_days)} onChange={(event) => update({ inactivity_days: Number(event.target.value) })}>
            <option value="1">1 day</option>
            <option value="2">2 days</option>
            <option value="3">3 days</option>
            <option value="7">1 week</option>
          </SelectField>
          <div className="flex flex-wrap items-center gap-2">
            {prefs.snoozed_until && new Date(prefs.snoozed_until) > new Date() ? (
              <>
                <span>Snoozed until {new Date(prefs.snoozed_until).toLocaleDateString()}.</span>
                <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => update({ snoozed_until: null })}>
                  End snooze
                </button>
              </>
            ) : (
              <>
                <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => update({ snoozed_until: new Date(Date.now() + 86_400_000).toISOString() })}>
                  Snooze for a day
                </button>
                <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => update({ snoozed_until: new Date(Date.now() + 7 * 86_400_000).toISOString() })}>
                  Snooze for a week
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function AiSection() {
  const { preferences, updatePreferences, clearChat, messages } = useWorkspaceData();
  const { announce } = useNotify();
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <p className="mc-label">Assistant response detail</p>
        <Segmented
          label="Assistant response detail"
          value={preferences.responseDetail}
          options={[["brief", "Brief"], ["balanced", "Balanced"], ["detailed", "Detailed"]]}
          onChange={(value) => updatePreferences({ responseDetail: value as Preferences["responseDetail"] })}
        />
      </div>
      <SelectField label="Assistant language" value={preferences.language} onChange={(event) => updatePreferences({ language: event.target.value })}>
        <option value="auto">Same as my message</option>
        <option value="English">English</option>
        <option value="Danish">Danish</option>
        <option value="Spanish">Spanish</option>
        <option value="Italian">Italian</option>
        <option value="German">German</option>
        <option value="French">French</option>
        <option value="Portuguese">Portuguese</option>
      </SelectField>

      <section className="rounded-xl border border-border p-4">
        <h3 className="font-bold">What is sent to the AI provider</h3>
        <p className="mt-1">
          The assistant uses Google&apos;s Gemini API, called from the Mindcraft server. When you ask for help, Mindcraft sends only:
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>your message and the last few messages of this chat</li>
          <li>the selected task (title, description, expected result, deadline, priority, status, steps)</li>
          <li>the titles, status, and deadlines of your other open tasks</li>
          <li>which block types are in your workspace</li>
          <li>your response detail, language, and planning style preferences</li>
        </ul>
        <p className="mt-2">
          Notes, calendar events, your email, and your other settings are not sent. Voice recordings are sent once to be turned into text and are
          not stored by Mindcraft. The assistant can only suggest changes; nothing is changed until you apply a suggestion.
        </p>
      </section>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-bold">Chat history</h3>
        <p className="mc-hint mt-1">{messages.length} saved messages.</p>
        <button
          type="button"
          className="mc-btn mc-btn-danger mt-3"
          disabled={!messages.length}
          onClick={async () => {
            if (!window.confirm("Clear the whole chat history? This cannot be undone.")) return;
            await clearChat();
            announce("Chat history cleared.");
          }}
        >
          Clear chat history
        </button>
      </div>
    </div>
  );
}

function AccountSection() {
  const { email, mode, signOut, updatePreferences } = useWorkspaceData();
  const { announce } = useNotify();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex max-w-md flex-col gap-5">
      {mode === "demo" ? (
        <p className="rounded-xl bg-surface-muted p-3">
          Demo data stays in this browser and is deleted when you leave.
        </p>
      ) : (
        <>
          <p>
            Signed in as <strong>{email}</strong>
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (password.length < 8) {
                setMessage("Use at least 8 characters.");
                return;
              }
              const { error } = await getBrowserSupabase().auth.updateUser({ password });
              setMessage(error ? "The password could not be changed. Please try again." : "Password changed.");
              if (!error) setPassword("");
            }}
          >
            <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {message ? <p role="status">{message}</p> : null}
            <button type="submit" className="mc-btn mc-btn-secondary self-start">
              Change password
            </button>
          </form>
        </>
      )}
      <button
        type="button"
        className="mc-btn mc-btn-secondary self-start"
        onClick={async () => {
          if (!window.confirm("Restore every preference to its default? Your workspace and tasks are not affected.")) return;
          await updatePreferences(DEFAULT_PREFERENCES);
          announce("Preferences restored to defaults.");
        }}
      >
        Reset all preferences
      </button>
      <button type="button" className="mc-btn mc-btn-primary self-start" onClick={signOut}>
        {mode === "demo" ? "Leave demo and delete demo data" : "Sign out"}
      </button>
      {mode !== "demo" ? (
        <p className="mc-hint">To delete your account, contact the Mindcraft team.</p>
      ) : null}
    </div>
  );
}
