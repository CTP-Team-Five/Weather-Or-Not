"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }

    const hash = window.location.hash;
    const search = window.location.search;
    const errParam = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : "").get("error_description")
      ?? new URLSearchParams(search).get("error_description");
    if (errParam) {
      setError(errParam);
      return;
    }

    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      window.history.replaceState({}, "", "/");
      router.replace("/");
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        finish();
        return;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setError("Could not complete sign-in. The link may have expired.");
      }
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <p className="text-lg font-semibold text-foreground mb-2">Sign-in failed</p>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => router.replace("/auth")}
              className="text-sm text-accent hover:underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
