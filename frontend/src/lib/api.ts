import type { Credentials } from "./validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthResponse {
  user: { id: string; email: string };
  accessToken: string;
}

export interface WalletBalance {
  balance: string;
}

export interface WalletTransaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAW" | "TRANSFER_IN" | "TRANSFER_OUT";
  amount: string;
  counterpartyId: string | null;
  createdAt: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? body.message
        : undefined;
    throw new ApiError(
      Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Something went wrong. Please try again.",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function login(credentials: Credentials): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function register(credentials: Credentials): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function getBalance(token: string): Promise<WalletBalance> {
  return request<WalletBalance>("/wallet/balance", {}, token);
}

export function getTransactions(token: string): Promise<WalletTransaction[]> {
  return request<WalletTransaction[]>("/transactions", {}, token);
}

export function createTransaction(
  token: string,
  action: "deposit" | "withdraw",
  amount: number,
): Promise<WalletTransaction> {
  return request<WalletTransaction>(
    `/transactions/${action}`,
    { method: "POST", body: JSON.stringify({ amount }) },
    token,
  );
}
