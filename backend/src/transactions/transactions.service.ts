import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import type { AmountDto } from './dto/amount.dto.js';
import type { TransferDto } from './dto/transfer.dto.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { balance: user.balance.toFixed(2) };
  }

  async getHistory(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toFixed(2),
    }));
  }

  async deposit(user: AuthUser, dto: AmountDto) {
    const amount = this.parseAmount(dto.amount);
    const transaction = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { balance: { increment: amount } },
      });
      return tx.transaction.create({
        data: { userId: user.id, type: 'DEPOSIT', amount },
      });
    });
    return { ...transaction, amount: transaction.amount.toFixed(2) };
  }

  async withdraw(user: AuthUser, dto: AmountDto) {
    const amount = this.parseAmount(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Insufficient funds');
      }
      const transaction = await tx.transaction.create({
        data: { userId: user.id, type: 'WITHDRAW', amount },
      });
      return { ...transaction, amount: transaction.amount.toFixed(2) };
    });
  }

  async transfer(user: AuthUser, dto: TransferDto) {
    const amount = this.parseAmount(dto.amount);
    if (dto.recipientEmail === user.email) {
      throw new BadRequestException('Cannot transfer to yourself');
    }
    const recipient = await this.prisma.user.findUnique({
      where: { email: dto.recipientEmail },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Insufficient funds');
      }

      await tx.user.update({
        where: { id: recipient.id },
        data: { balance: { increment: amount } },
      });
      const transactions = await Promise.all([
        tx.transaction.create({
          data: {
            userId: user.id,
            type: 'TRANSFER_OUT',
            amount,
            counterpartyId: recipient.id,
          },
        }),
        tx.transaction.create({
          data: {
            userId: recipient.id,
            type: 'TRANSFER_IN',
            amount,
            counterpartyId: user.id,
          },
        }),
      ]);
      return transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toFixed(2),
      }));
    });
  }

  private parseAmount(value: number): Prisma.Decimal {
    const amount = new Prisma.Decimal(value);
    if (
      !amount.isFinite() ||
      !amount.greaterThan(0) ||
      amount.decimalPlaces() > 2 ||
      amount.greaterThan('9999999999.99')
    ) {
      throw new BadRequestException(
        'Amount must be positive, at most 9999999999.99, and have at most 2 decimal places',
      );
    }
    return amount;
  }
}
