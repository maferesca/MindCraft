"use client";

import { useState, type FormEvent } from "react";
import { AuthShell, FormMessage } from "@/components/auth/auth-shell";
import { TextField } from "@/components/ui/field";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Reached from the recovery email via /auth/callback, which signs the user in.
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: updateError } = await getBrowserSupabase().auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("This reset link may have expired. Request a new one from the sign-in page.");
      return;
    }
    // Full page load so the session cookie and workspace data are read fresh.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/workspace");
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" className="mc-btn mc-btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
