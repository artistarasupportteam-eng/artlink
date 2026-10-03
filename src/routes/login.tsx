import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { ErrorNote } from "@/components/ui";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [error, setError] = useState("");
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-3xl">ART<span className="text-accent">Link</span></Link>
        <h1 className="mt-6 font-display text-2xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Use your Google account to create and manage links. Public pages stay open without an account.</p>
        <div className="mt-6 grid gap-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                className="h-11 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
                onClick={() => {
                  setError("");
                  void signIn(provider.providerId, { callbackURL: "/", errorCallbackURL: "/login" }).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "Sign-in failed.");
                  });
                }}
              >
                Continue with {provider.label}
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>
        <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>
      </div>
    </main>
  );
}
