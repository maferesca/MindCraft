"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell, FormMessage } from "@/components/auth/auth-shell";
import { TextField } from "@/components/ui/field";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const MIN_PASSWORD = 8;

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter an email address like name@example.com.";
    if (password.length < MIN_PASSWORD) nextErrors.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    const { data, error } = await getBrowserSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome` },
    });
    setLoading(false);
    if (error) {
      setErrors({ form: error.message || "We could not create the account. Please try again." });
      return;
    }
    if (data.session) {
      // Full page load so the session cookie and workspace data are read fresh.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/welcome");
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <FormMessage tone="success">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account. You can close this page.
        </FormMessage>
        <p className="mt-4">
          <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" intro="You can set up the rest later. Nothing personal beyond your email is required.">
      {isSupabaseConfigured ? (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {errors.form ? <FormMessage tone="error">{errors.form}</FormMessage> : null}
          <TextField label="Email" type="email" autoComplete="email" value={email} error={errors.email} onChange={(event) => setEmail(event.target.value)} />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters.`}
            value={password}
            error={errors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" className="mc-btn mc-btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
          <p>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <FormMessage tone="error">Accounts are not set up on this server yet. See the README to add Supabase settings.</FormMessage>
      )}
    </AuthShell>
  );
}
