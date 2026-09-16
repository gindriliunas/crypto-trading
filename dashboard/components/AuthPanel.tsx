"use client";

import { useState, type FormEvent } from "react";

type AuthPanelProps = {
  email: string | null;
  configured: boolean;
  onAuthChange: () => void;
};

export function AuthPanel({ email, configured, onAuthChange }: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
        Cognito is not configured locally. Trades stay in this browser until you
        deploy with JWT auth + Postgres.
      </div>
    );
  }

  if (email) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <p className="text-sm text-zinc-300">
          Signed in as <span className="font-medium text-zinc-50">{email}</span>
          <span className="text-zinc-500"> · history saved to your account</span>
        </p>
        <button
          type="button"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            onAuthChange();
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      if (mode === "signup") {
        const login = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail, password }),
        });
        const loginPayload = (await login.json()) as { error?: string };
        if (!login.ok) {
          throw new Error(loginPayload.error ?? "Account created, but login failed");
        }
      }

      setPassword("");
      onAuthChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {mode === "login" ? "Sign in to save trades" : "Create an account"}
          </p>
          <p className="text-xs text-zinc-500">
            Paper trades and P&amp;L history sync to your account in Postgres.
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-cyan-400 hover:text-cyan-300"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={formEmail}
          onChange={(event) => setFormEmail(event.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="Password (8+ chars)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
