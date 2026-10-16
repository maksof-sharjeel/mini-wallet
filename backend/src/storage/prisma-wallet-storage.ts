import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  WalletStorage,
  WalletTransactionRecord,
  WalletUserRecord,
} from './wallet-storage.js';

@Injectable()
export class PrismaWalletStorage implements WalletStorage {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<WalletUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.userRecord(user) : null;
  }

  async createUser(
    email: string,
    passwordHash: string,
  ): Promise<WalletUserRecord> {
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });
    return this.userRecord(user);
  }

  async getBalance(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.balance.toFixed(2);
  }

  async getHistory(userId: string): Promise<WalletTransactionRecord[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return transactions.map((transaction) =>
      this.transactionRecord(transaction),
    );
  }

  async deposit(
    userId: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord> {
    const decimal = new Prisma.Decimal(amount);
    const transaction = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: decimal } },
      });
      return tx.transaction.create({
        data: { userId, type: 'DEPOSIT', amount: decimal, description },
      });
    });
    return this.transactionRecord(transaction);
  }

  async withdraw(
    userId: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord> {
    const decimal = new Prisma.Decimal(amount);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, balance: { gte: decimal } },
        data: { balance: { decrement: decimal } },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Insufficient funds');
      }
      const transaction = await tx.transaction.create({
        data: { userId, type: 'WITHDRAW', amount: decimal, description },
      });
      return this.transactionRecord(transaction);
    });
  }

  async transfer(
    senderId: string,
    senderEmail: string,
    recipientEmail: string,
    amount: string,
    description: string,
  ): Promise<WalletTransactionRecord[]> {
    if (recipientEmail === senderEmail) {
      throw new BadRequestException('Cannot transfer to yourself');
    }
    const recipient = await this.prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    const decimal = new Prisma.Decimal(amount);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: senderId, balance: { gte: decimal } },
        data: { balance: { decrement: decimal } },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Insufficient funds');
      }
      await tx.user.update({
        where: { id: recipient.id },
        data: { balance: { increment: decimal } },
      });
      const transactions = await Promise.all([
        tx.transaction.create({
          data: {
            userId: senderId,
            type: 'TRANSFER_OUT',
            amount: decimal,
            description,
            counterpartyId: recipient.id,
          },
        }),
        tx.transaction.create({
          data: {
            userId: recipient.id,
            type: 'TRANSFER_IN',
            amount: decimal,
            description,
            counterpartyId: senderId,
          },
        }),
      ]);
      return transactions.map((transaction) =>
        this.transactionRecord(transaction),
      );
    });
  }

  private userRecord(user: {
    id: string;
    email: string;
    passwordHash: string;
    balance: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): WalletUserRecord {
    return {
      ...user,
      balance: user.balance.toFixed(2),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private transactionRecord(transaction: {
    id: string;
    userId: string;
    type: WalletTransactionRecord['type'];
    amount: Prisma.Decimal;
    description: string | null;
    counterpartyId: string | null;
    createdAt: Date;
  }): WalletTransactionRecord {
    return {
      ...transaction,
      amount: transaction.amount.toFixed(2),
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
