import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TransactionType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  amountToCents,
  centsToAmount,
  type WalletStorage,
  type WalletTransactionRecord,
  type WalletUserRecord,
} from './wallet-storage.js';

interface WalletFile {
  users: WalletUserRecord[];
  transactions: WalletTransactionRecord[];
}

const MAX_BALANCE_CENTS = 999999999999n;

@Injectable()
export class JsonWalletStorage implements WalletStorage {
  private readonly filePath: string;
  private data: WalletFile | undefined;
  private loading: Promise<void> | undefined;
  private writes = Promise.resolve();

  constructor(
    filePath = process.env.WALLET_JSON_PATH
      ? resolve(process.env.WALLET_JSON_PATH)
      : resolve(process.cwd(), 'data', 'wallet.json'),
  ) {
    this.filePath = filePath;
  }

  async findUserByEmail(email: string): Promise<WalletUserRecord | null> {
    await this.writes;
    await this.ensureLoaded();
    const user = this.data!.users.find(
      (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
    );
    return user ? structuredClone(user) : null;
  }

  async createUser(
    email: string,
    passwordHash: string,
  ): Promise<WalletUserRecord> {
    return this.mutate((data) => {
      if (
        data.users.some(
          (user) => user.email.toLowerCase() === email.toLowerCase(),
        )
      ) {
        throw new ConflictException('Email already registered');
      }
      const now = new Date().toISOString();
      const user: WalletUserRecord = {
        id: randomUUID(),
        email,
        passwordHash,
        balance: '0.00',
        createdAt: now,
        updatedAt: now,
      };
      data.users.push(user);
      return structuredClone(user);
    });
  }

  async getBalance(userId: string): Promise<string> {
    await this.writes;
    await this.ensureLoaded();
    const user = this.findUser(this.data!, userId);
    return user.balance;
  }

  async getHistory(userId: string): Promise<WalletTransactionRecord[]> {
    await this.writes;
    await this.ensureLoaded();
    this.findUser(this.data!, userId);
    return this.data!.transactions.filter(
      (transaction) => transaction.userId === userId,
    )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100)
      .map((transaction) => structuredClone(transaction));
  }

  async deposit(
    userId: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord> {
    return this.mutate((data) => {
      const user = this.findUser(data, userId);
      user.balance = this.addBalance(user.balance, amount);
      user.updatedAt = new Date().toISOString();
      return this.addTransaction(
        data,
        userId,
        'DEPOSIT',
        amount,
        description,
        null,
      );
    });
  }

  async withdraw(
    userId: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord> {
    return this.mutate((data) => {
      const user = this.findUser(data, userId);
      const balance = BigInt(Math.round(Number(user.balance) * 100));
      const cents = amountToCents(amount);
      if (balance < cents) {
        throw new BadRequestException('Insufficient funds');
      }
      user.balance = centsToAmount(balance - cents);
      user.updatedAt = new Date().toISOString();
      return this.addTransaction(
        data,
        userId,
        'WITHDRAW',
        amount,
        description,
        null,
      );
    });
  }

  async transfer(
    senderId: string,
    senderEmail: string,
    recipientEmail: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord[]> {
    return this.mutate((data) => {
      if (senderEmail.toLowerCase() === recipientEmail.toLowerCase()) {
        throw new BadRequestException('Cannot transfer to yourself');
      }
      const sender = this.findUser(data, senderId);
      const recipient = data.users.find(
        (user) => user.email.toLowerCase() === recipientEmail.toLowerCase(),
      );
      if (!recipient) {
        throw new NotFoundException('Recipient not found');
      }

      const senderBalance = BigInt(Math.round(Number(sender.balance) * 100));
      const cents = amountToCents(amount);
      if (senderBalance < cents) {
        throw new BadRequestException('Insufficient funds');
      }
      const recipientBalance = BigInt(
        Math.round(Number(recipient.balance) * 100),
      );
      if (recipientBalance + cents > MAX_BALANCE_CENTS) {
        throw new BadRequestException('Recipient balance limit exceeded');
      }

      sender.balance = centsToAmount(senderBalance - cents);
      sender.updatedAt = new Date().toISOString();
      recipient.balance = centsToAmount(recipientBalance + cents);
      recipient.updatedAt = new Date().toISOString();
      return [
        this.addTransaction(
          data,
          senderId,
          'TRANSFER_OUT',
          amount,
          description,
          recipient.id,
        ),
        this.addTransaction(
          data,
          recipient.id,
          'TRANSFER_IN',
          amount,
          description,
          senderId,
        ),
      ];
    });
  }

  private async ensureLoaded(): Promise<void> {
    if (this.data) return;
    this.loading ??= this.load();
    await this.loading;
  }

  private async load(): Promise<void> {
    try {
      const contents = await readFile(this.filePath, 'utf8');
      let data: unknown;
      try {
        data = JSON.parse(contents);
      } catch (error) {
        throw new Error(
          `Wallet data file is not valid JSON: ${this.filePath}`,
          {
            cause: error,
          },
        );
      }
      if (
        typeof data !== 'object' ||
        data === null ||
        !('users' in data) ||
        !Array.isArray(data.users) ||
        !('transactions' in data) ||
        !Array.isArray(data.transactions)
      ) {
        throw new Error(
          `Wallet data file has an invalid structure: ${this.filePath}`,
        );
      }
      const wallet = data as WalletFile;
      this.data = {
        users: wallet.users,
        transactions: wallet.transactions.map((transaction) => ({
          ...transaction,
          description: transaction.description ?? null,
        })),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        this.data = { users: [], transactions: [] };
        return;
      }
      throw error;
    }
  }

  private async mutate<T>(change: (data: WalletFile) => T): Promise<T> {
    let release!: () => void;
    const previous = this.writes;
    this.writes = new Promise<void>((resolveWrite) => {
      release = resolveWrite;
    });
    await previous;
    try {
      await this.ensureLoaded();
      const draft = structuredClone(this.data!);
      const result = change(draft);
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(draft, null, 2), 'utf8');
      await rename(temporaryPath, this.filePath);
      this.data = draft;
      return result;
    } finally {
      release();
    }
  }

  private findUser(data: WalletFile, userId: string): WalletUserRecord {
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private addBalance(current: string, amount: string): string {
    const updated = amountToCents(current) + amountToCents(amount);
    if (updated > MAX_BALANCE_CENTS) {
      throw new BadRequestException('Wallet balance limit exceeded');
    }
    return centsToAmount(updated);
  }

  private addTransaction(
    data: WalletFile,
    userId: string,
    type: TransactionType,
    amount: string,
    description: string,
    counterpartyId: string | null,
  ): WalletTransactionRecord {
    const transaction: WalletTransactionRecord = {
      id: randomUUID(),
      userId,
      type,
      amount,
      description,
      counterpartyId,
      createdAt: new Date().toISOString(),
    };
    data.transactions.push(transaction);
    return structuredClone(transaction);
  }
}
