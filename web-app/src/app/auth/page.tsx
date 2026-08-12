"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { markAppEntered } from "@/lib/app-session";
import { useAuthStore } from "@/store/auth-store";
import LoadingState from "@/components/ui/LoadingState";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const modeParam = params.get("mode");
  const [mode, setMode] = useState<"signin" | "signup">(
    modeParam === "signup" ? "signup" : "signin"
  );
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !user) return;
    markAppEntered();
    if (!user.onboardingDone) router.replace("/onboarding");
    else router.replace("/app");
  }, [hydrated, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res =
        mode === "signup"
          ? await signUp({ email, password, name })
          : await signIn({ email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      markAppEntered();
      const u = useAuthStore.getState().user;
      if (u && !u.onboardingDone) router.push("/onboarding");
      else router.push("/app");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="sw-auth-page">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  return (
    <div className="sw-auth-page">
      <div className="sw-auth-card">
        <div className="sw-auth-brand">
          <span className="sw-auth-logo">🛡</span>
          <div>
            <div className="sw-auth-title">SentinelWatch</div>
            <div className="sw-auth-sub">Personal crisis awareness</div>
          </div>
        </div>

        <p className="sw-auth-local-note">
          Profiles stay on this device — encrypted locally, never sent to a server.
        </p>

        <div className="sw-auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "is-active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "is-active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={onSubmit} className="sw-auth-form">
          {mode === "signup" && (
            <label>
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 10 characters" : "Your password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={10}
              required
            />
          </label>

          {error && <div className="sw-auth-error">{error}</div>}

          <button type="submit" className="sw-auth-submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="sw-auth-note">
          Accounts are stored on this device for beta — free, no third-party login required.
        </p>

        <Link href="/" className="sw-auth-guest">
          ← Continue without account
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="sw-auth-page">
          <LoadingState label="Loading…" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
