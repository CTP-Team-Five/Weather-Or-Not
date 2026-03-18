"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/useAuth";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) router.push("/");
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || submitting) return;
    setSubmitting(true);
    setError(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setSubmitting(false);
      } else {
        router.push("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setSubmitting(false);
      } else {
        setSignupDone(true);
        setSubmitting(false);
      }
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="font-display text-2xl tracking-tight">
            <span className="font-normal text-muted-foreground">Weather</span>
            <span className="font-extrabold italic text-foreground">OrNot</span>
          </span>
        </div>

        <div className="surface-elevated p-8">
          {signupDone ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground mb-2">Check your email</p>
              <p className="text-sm text-muted-foreground mb-6">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              <button
                onClick={() => { setSignupDone(false); setMode("signin"); }}
                className="text-sm text-accent hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground mb-6">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h1>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition"
                  />
                </div>

                {error && (
                  <p className="text-sm text-danger">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>No account?{" "}
                    <button onClick={() => { setMode("signup"); setError(null); }} className="text-accent hover:underline">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>Already have one?{" "}
                    <button onClick={() => { setMode("signin"); setError(null); }} className="text-accent hover:underline">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        {!supabase && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Auth requires Supabase env vars to be configured.
          </p>
        )}
      </div>
    </main>
  );
}
