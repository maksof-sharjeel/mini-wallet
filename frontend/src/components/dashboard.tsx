"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createTransaction,
  getBalance,
  getTransactions,
  type WalletTransaction,
} from "@/lib/api";
import { amountSchema } from "@/lib/validation";

type Action = "deposit" | "withdraw";

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<Action>("deposit");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshWallet = useCallback(async (authToken: string) => {
    const [wallet, history] = await Promise.all([
      getBalance(authToken),
      getTransactions(authToken),
    ]);
    setBalance(wallet.balance);
    setTransactions(history);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      const savedToken = window.localStorage.getItem("mini-wallet-token");
      const savedEmail = window.localStorage.getItem("mini-wallet-email") ?? "";
      if (!savedToken) {
        router.replace("/login");
        return;
      }

      await Promise.resolve();
      if (!active) return;
      setToken(savedToken);
      setEmail(savedEmail);

      try {
        await refreshWallet(savedToken);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          window.localStorage.removeItem("mini-wallet-token");
          router.replace("/login");
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your wallet. Please try again.",
        );
      }
    }

    void loadWallet();
    return () => {
      active = false;
    };
  }, [refreshWallet, router]);

  async function handleTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const result = amountSchema.safeParse({ amount });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid amount.");
      return;
    }

    setBusy(true);
    try {
      await createTransaction(token, action, result.data.amount);
      await refreshWallet(token);
      setAmount("");
      setNotice(action === "deposit" ? "Deposit successful." : "Withdrawal successful.");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not complete the transaction. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem("mini-wallet-token");
    window.localStorage.removeItem("mini-wallet-email");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#e7e9e2] bg-white">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <a className="flex items-center gap-3 font-semibold" href="/dashboard">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dceee3] text-[#286b53]">
              <WalletMark />
            </span>
            <span>Mini Wallet</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[#6e7d77] sm:block">{email}</span>
            <button
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#53645d] transition hover:bg-[#f5f5f0]"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-[#286b53]">YOUR OVERVIEW</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Your wallet
          </h1>
          <p className="mt-2 text-sm text-[#6e7d77]">
            Your balance and recent activity, all in one place.
          </p>
        </div>

        {error && (
          <p
            className="mb-6 rounded-xl border border-[#f1d2cb] bg-[#fff5f2] px-4 py-3 text-sm text-[#a64432]"
            role="alert"
          >
            {error}
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="relative min-h-[220px] overflow-hidden rounded-3xl bg-[#1f493b] p-7 text-white sm:p-9">
            <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-1 -top-14 h-52 w-52 rounded-full border border-white/10" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/70">Available balance</p>
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80">
                  WALLET
                </span>
              </div>
              <div className="mt-8">
                <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {balance === null ? "..." : `$${balance}`}
                </p>
                <p className="mt-3 text-sm text-white/65">Your money at a glance</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-[#e7e9e2] bg-white p-6 sm:p-7">
            <div className="mb-6">
              <p className="text-sm font-medium text-[#286b53]">QUICK ACTION</p>
              <h2 className="mt-2 text-xl font-semibold">Move money</h2>
            </div>
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#f5f5f0] p-1">
              {(["deposit", "withdraw"] as const).map((nextAction) => (
                <button
                  aria-pressed={action === nextAction}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition ${
                    action === nextAction
                      ? "bg-white text-[#286b53] shadow-sm"
                      : "text-[#6e7d77] hover:text-[#182824]"
                  }`}
                  key={nextAction}
                  onClick={() => {
                    setAction(nextAction);
                    setError("");
                    setNotice("");
                  }}
                  type="button"
                >
                  {nextAction}
                </button>
              ))}
            </div>
            <form onSubmit={handleTransaction} noValidate>
              <label className="mb-2 block text-sm font-medium" htmlFor="amount">
                Amount
              </label>
              <div className="flex h-12 items-center rounded-xl border border-[#dfe4dd] bg-white px-4 focus-within:border-[#286b53] focus-within:ring-4 focus-within:ring-[#286b53]/10">
                <span className="mr-2 text-[#89948e]">$</span>
                <input
                  className="h-full w-full bg-transparent text-sm outline-none"
                  id="amount"
                  inputMode="decimal"
                  max="9999999999.99"
                  min="0.01"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={amount}
                />
              </div>
              {notice && (
                <p className="mt-3 text-sm text-[#286b53]" role="status">
                  {notice}
                </p>
              )}
              <button
                className="mt-5 h-12 w-full rounded-xl bg-[#286b53] px-4 text-sm font-semibold text-white transition hover:bg-[#205641] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy || !token}
                type="submit"
              >
                {busy
                  ? "Processing..."
                  : action === "deposit"
                    ? "Deposit money"
                    : "Withdraw money"}
              </button>
            </form>
          </article>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-[#e7e9e2] bg-white">
          <div className="flex items-center justify-between border-b border-[#e7e9e2] px-6 py-5 sm:px-7">
            <div>
              <p className="text-sm font-medium text-[#286b53]">ACTIVITY</p>
              <h2 className="mt-1 text-xl font-semibold">Recent transactions</h2>
            </div>
            <span className="text-xs text-[#89948e]">Latest 100</span>
          </div>
          {transactions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5ef] text-[#286b53]">
                <ActivityMark />
              </div>
              <p className="mt-4 font-medium">No activity yet</p>
              <p className="mt-1 text-sm text-[#6e7d77]">
                Your deposits and withdrawals will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#e7e9e2]">
              {transactions.map((transaction) => {
                const incoming =
                  transaction.type === "DEPOSIT" ||
                  transaction.type === "TRANSFER_IN";
                return (
                  <li
                    className="flex items-center justify-between gap-4 px-6 py-4 sm:px-7"
                    key={transaction.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                          incoming
                            ? "bg-[#e4f3e9] text-[#286b53]"
                            : "bg-[#f4ece7] text-[#a86648]"
                        }`}
                      >
                        <ActivityMark incoming={incoming} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {transaction.type.replaceAll("_", " ").toLowerCase()}
                        </p>
                        <p className="mt-1 text-xs text-[#89948e]">
                          {new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(transaction.createdAt))}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        incoming ? "text-[#286b53]" : "text-[#182824]"
                      }`}
                    >
                      {incoming ? "+" : "−"}${transaction.amount}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
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

function ActivityMark({ incoming = true }: { incoming?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d={incoming ? "M12 5v14m-7-7 7 7 7-7" : "M12 19V5m7 7-7-7-7 7"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
