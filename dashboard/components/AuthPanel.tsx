"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

type AuthPanelProps = {
  email: string | null;
  configured: boolean;
  onAuthChange: () => void;
};

type AuthMeta = {
  signupEnabled: boolean;
  inviteRequired: boolean;
  resetEnabled: boolean;
  minPasswordLength: number;
};

type Mode = "login" | "signup" | "reset";

export function AuthPanel({ email, configured, onAuthChange }: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [meta, setMeta] = useState<AuthMeta>({
    signupEnabled: false,
    inviteRequired: false,
    resetEnabled: false,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });

  useEffect(() => {
    void Promise.all([
      fetch("/api/auth/signup").then((r) => r.json()),
      fetch("/api/auth/reset-password").then((r) => r.json()),
    ])
      .then(([signup, reset]) => {
        setMeta({
          signupEnabled: Boolean(signup.signupEnabled),
          inviteRequired: Boolean(
            signup.inviteRequired || reset.inviteRequired,
          ),
          resetEnabled: Boolean(reset.resetEnabled),
          minPasswordLength:
            Number(signup.minPasswordLength) || MIN_PASSWORD_LENGTH,
        });
      })
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

  async function submitChangePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to change password");
      }
      setCurrentPassword("");
      setNewPassword("");
      setShowChangePassword(false);
      setNotice("Password updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setBusy(false);
    }
  }

  if (email) {
    return (
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">
            Signed in as <span className="font-medium text-zinc-50">{email}</span>
            <span className="text-zinc-500"> · history saved to your account</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => {
                setShowChangePassword((v) => !v);
                setError(null);
                setNotice(null);
              }}
            >
              {showChangePassword ? "Cancel" : "Change password"}
            </button>
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
        </div>
        {showChangePassword ? (
          <form onSubmit={submitChangePassword} className="grid gap-3 sm:grid-cols-3">
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            <input
              type="password"
              required
              minLength={meta.minPasswordLength}
              autoComplete="new-password"
              placeholder={`New password (${meta.minPasswordLength}+ chars)`}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {busy ? "…" : "Update password"}
            </button>
          </form>
        ) : null}
        {notice ? <p className="text-sm text-emerald-400">{notice}</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail, password, inviteCode }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to reset password");
        }
        setPassword("");
        setInviteCode("");
        setMode("login");
        setNotice("Password reset. Sign in with your new password.");
        return;
      }

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

  const canSignup = meta.signupEnabled;
  const title =
    mode === "login"
      ? "Sign in to save trades"
      : mode === "signup"
        ? "Create an account"
        : "Reset password";
  const submitLabel =
    mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Reset password";

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{title}</p>
          <p className="text-xs text-zinc-500">
            {mode === "reset"
              ? "Operator-approved recovery using the same invite code as signup (no email reset link)."
              : "Paper trades and P&L history sync to your account in Postgres. Passwords must be at least "}
            {mode !== "reset" ? `${meta.minPasswordLength} characters.` : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {canSignup && mode !== "reset" ? (
            <button
              type="button"
              className="text-xs text-cyan-400 hover:text-cyan-300"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "login" ? "Need an account?" : "Have an account?"}
            </button>
          ) : null}
          {meta.resetEnabled ? (
            <button
              type="button"
              className="text-xs text-cyan-400 hover:text-cyan-300"
              onClick={() => {
                setMode(mode === "reset" ? "login" : "reset");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "reset" ? "Back to sign in" : "Forgot password?"}
            </button>
          ) : null}
        </div>
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
          minLength={
            mode === "login" ? 1 : meta.minPasswordLength
          }
          autoComplete={
            mode === "login" ? "current-password" : "new-password"
          }
          placeholder={
            mode === "login"
              ? "Password"
              : `Password (${meta.minPasswordLength}+ chars)`
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
          {busy ? "…" : submitLabel}
        </button>
      </div>
      {(mode === "signup" || mode === "reset") && meta.inviteRequired ? (
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
      {notice ? <p className="mt-2 text-sm text-emerald-400">{notice}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
