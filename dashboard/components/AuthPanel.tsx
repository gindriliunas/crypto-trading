"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

type AuthPanelProps = {
  email: string | null;
  configured: boolean;
  onAuthChange: () => void;
};

type SignupMeta = {
  signupEnabled: boolean;
  inviteRequired: boolean;
  minPasswordLength: number;
};

export function AuthPanel({ email, configured, onAuthChange }: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupMeta, setSignupMeta] = useState<SignupMeta>({
    signupEnabled: false,
    inviteRequired: false,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });

  useEffect(() => {
    void fetch("/api/auth/signup")
      .then((r) => r.json())
      .then((data: SignupMeta) => setSignupMeta(data))
      .catch(() => undefined);
  }, []);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
        Auth is not configured locally. Set JWT_SECRET and DATABASE_URL, or deploy
        to Azure where Terraform injects them.
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
        body: JSON.stringify({
          email: formEmail,
          password,
          ...(mode === "signup" ? { inviteCode } : {}),
        }),
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
      setInviteCode("");
      onAuthChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  const canSignup = signupMeta.signupEnabled;

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
            Passwords must be at least {signupMeta.minPasswordLength} characters.
          </p>
        </div>
        {canSignup ? (
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
        ) : null}
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
          minLength={mode === "signup" ? signupMeta.minPasswordLength : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={
            mode === "signup"
              ? `Password (${signupMeta.minPasswordLength}+ chars)`
              : "Password"
          }
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={busy || (mode === "signup" && !canSignup)}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </div>
      {mode === "signup" && signupMeta.inviteRequired ? (
        <input
          type="text"
          required
          autoComplete="off"
          placeholder="Invite code"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      ) : null}
      {!canSignup && mode === "login" ? (
        <p className="mt-2 text-xs text-zinc-500">
          New accounts require an invite from the operator (Cyber Essentials access control).
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
