import type { TransactionType } from '@prisma/client';

export const WALLET_STORAGE = Symbol('WALLET_STORAGE');

export interface WalletUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  type: TransactionType;
  amount: string;
  description: string | null;
  counterpartyId: string | null;
  createdAt: string;
}

export interface WalletStorage {
  findUserByEmail(email: string): Promise<WalletUserRecord | null>;
  createUser(email: string, passwordHash: string): Promise<WalletUserRecord>;
  getBalance(userId: string): Promise<string>;
  getHistory(userId: string): Promise<WalletTransactionRecord[]>;
  deposit(
    userId: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord>;
  withdraw(
    userId: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord>;
  transfer(
    senderId: string,
    senderEmail: string,
    recipientEmail: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord[]>;
}

export function amountToCents(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function centsToAmount(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
