"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell, FormMessage } from "@/components/auth/auth-shell";
import { TextField } from "@/components/ui/field";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: resetError } = await getBrowserSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError("We could not send the email right now. Please try again in a moment.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell title="Reset your password" intro="We will email you a link to choose a new password.">
      {sent ? (
        <FormMessage tone="success">If an account exists for that email, a reset link is on its way.</FormMessage>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <TextField label="Email" type="email" autoComplete="email" value={email} error={error} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" className="mc-btn mc-btn-primary" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-4">
        <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
