"use client";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthShell, FormMessage } from "@/components/auth/auth-shell";
import { DemoEntry } from "@/components/auth/demo-entry";
import { TextField } from "@/components/ui/field";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// /auth/callback redirects here when an email link is invalid, expired, or used.
function LinkErrorMessage() {
  const failed = useSearchParams().get("error") === "link";
  if (!failed) return null;
  return <FormMessage tone="error">That link has expired or was already used. Sign in, or request a new link.</FormMessage>;
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter an email address like name@example.com.");
      return;
    }
    setLoading(true);
    const { error: signInError } = await getBrowserSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setLoading(false);
      if (isAuthRetryableFetchError(signInError)) {
        setError("We could not reach the sign-in service. Check your connection and try again.");
        return;
      }
      setError(
        signInError.message.toLowerCase().includes("confirm")
          ? "Please confirm your email first. Check your inbox for the link."
          : "That email and password did not match. Check them and try again.",
      );
      return;
    }
    // Full page load so the session cookie and workspace data are read fresh.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/workspace");
  }

  return (
    <AuthShell title="Sign in" footer={<DemoEntry />}>
      {isSupabaseConfigured ? (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Suspense fallback={null}>
            <LinkErrorMessage />
          </Suspense>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" className="mc-btn mc-btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex flex-wrap justify-between gap-2">
            <Link href="/forgot-password" className="font-semibold text-primary underline underline-offset-4">
              Forgot password?
            </Link>
            <Link href="/sign-up" className="font-semibold text-primary underline underline-offset-4">
              Create an account
            </Link>
          </div>
        </form>
      ) : (
        <FormMessage tone="error">
          Accounts are not set up on this server yet. Add the Supabase settings from .env.example, or try the local demo below.
        </FormMessage>
      )}
    </AuthShell>
  );
}
