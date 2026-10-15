"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, login, register } from "@/lib/api";
import { credentialsSchema, type Credentials } from "@/lib/validation";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const result = credentialsSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your details.");
      return;
    }

    setBusy(true);
    try {
      const credentials: Credentials = result.data;
      const response =
        mode === "login"
          ? await login(credentials)
          : await register(credentials);
      window.localStorage.setItem("mini-wallet-token", response.accessToken);
      window.localStorage.setItem("mini-wallet-email", response.user.email);
      router.push("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not connect to the server. Check that the backend is running.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#1f493b] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-36 -top-32 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="absolute -right-12 -top-8 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b6e2cb] text-[#1f493b]">
            <WalletMark />
          </span>
          Mini Wallet
        </div>
        <div className="relative max-w-xl pb-12">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#b6e2cb]">
            Money, made simple
          </p>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">
            A clearer view of your money.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
            Your everyday wallet, all in one calm and simple place.
          </p>
        </div>
        <p className="relative text-sm text-white/55">
          Your money. Your pace. Your peace of mind.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 font-semibold lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dceee3] text-[#286b53]">
              <WalletMark />
            </span>
            Mini Wallet
          </div>
          <p className="text-sm font-medium text-[#286b53]">
            {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {mode === "login" ? "Sign in to your wallet" : "Create your account"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#6e7d77]">
            {mode === "login"
              ? "Enter your details to pick up where you left off."
              : "Just your email and a password to get started."}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email address</span>
              <input
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[#dfe4dd] bg-white px-4 text-sm outline-none transition focus:border-[#286b53] focus:ring-4 focus:ring-[#286b53]/10"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Password</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="h-12 w-full rounded-xl border border-[#dfe4dd] bg-white px-4 text-sm outline-none transition focus:border-[#286b53] focus:ring-4 focus:ring-[#286b53]/10"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </label>

            {error && (
              <p
                className="rounded-xl border border-[#f1d2cb] bg-[#fff5f2] px-4 py-3 text-sm text-[#a64432]"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#286b53] px-4 text-sm font-semibold text-white transition hover:bg-[#205641] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#6e7d77]">
            {mode === "login" ? "New to Mini Wallet?" : "Already have an account?"}{" "}
            <button
              className="font-semibold text-[#286b53] hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              type="button"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="mt-10 text-center text-xs text-[#89948e]">
            Simple tools to help you stay on top of your money.
          </p>
        </div>
      </section>
    </main>
  );
}

function WalletMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4 8h16M16 13h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
