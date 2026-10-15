import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TransactionsService } from './transactions.service.js';

const owner = { id: 'user-1', email: 'owner@example.com' };
const amountDto = (amount: number) => ({ amount });

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    user: { update: jest.Mock; updateMany: jest.Mock };
    transaction: { create: jest.Mock };
  };

  beforeEach(() => {
    tx = {
      user: { update: jest.fn(), updateMany: jest.fn() },
      transaction: { create: jest.fn() },
    };
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      transaction: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    service = new TransactionsService(prisma as unknown as PrismaService);
  });

  describe('deposit', () => {
    it('increases the balance and records a deposit atomically', async () => {
      tx.transaction.create.mockResolvedValue({
        id: 'transaction-1',
        amount: new Prisma.Decimal('25.50'),
      });

      const result = await service.deposit(owner, amountDto(25.5));

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: owner.id },
        data: { balance: { increment: new Prisma.Decimal('25.5') } },
      });
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: owner.id,
          type: 'DEPOSIT',
          amount: new Prisma.Decimal('25.5'),
        },
      });
      expect(result.amount).toBe('25.50');
    });

    it.each([0, -1, 1.239, Number.NaN, Number.POSITIVE_INFINITY, 10000000000])(
      'rejects invalid amount %s without opening a transaction',
      async (amount) => {
        await expect(service.deposit(owner, amountDto(amount))).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );
  });

  describe('withdraw', () => {
    it('decreases the balance and records a withdrawal when funds are available', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 1 });
      tx.transaction.create.mockResolvedValue({
        id: 'transaction-2',
        amount: new Prisma.Decimal('10.00'),
      });

      const result = await service.withdraw(owner, amountDto(10));

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: owner.id, balance: { gte: new Prisma.Decimal(10) } },
        data: { balance: { decrement: new Prisma.Decimal(10) } },
      });
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: owner.id,
          type: 'WITHDRAW',
          amount: new Prisma.Decimal(10),
        },
      });
      expect(result.amount).toBe('10.00');
    });

    it('rejects withdrawal when the balance is insufficient and creates no record', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.withdraw(owner, amountDto(10))).rejects.toThrow(
        'Insufficient funds',
      );
      expect(tx.transaction.create).not.toHaveBeenCalled();
    });

    it('rejects an amount with more than two decimal places', async () => {
      await expect(service.withdraw(owner, amountDto(-0.01))).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    const transferDto = (recipientEmail: string, amount: number) => ({
      recipientEmail,
      amount,
    });

    it('moves funds and creates a matching record for both users', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      tx.user.updateMany.mockResolvedValue({ count: 1 });
      tx.transaction.create
        .mockResolvedValueOnce({
          id: 'out-1',
          amount: new Prisma.Decimal('7.25'),
        })
        .mockResolvedValueOnce({
          id: 'in-1',
          amount: new Prisma.Decimal('7.25'),
        });

      const result = await service.transfer(
        owner,
        transferDto('recipient@example.com', 7.25),
      );

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: owner.id, balance: { gte: new Prisma.Decimal('7.25') } },
        data: { balance: { decrement: new Prisma.Decimal('7.25') } },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { balance: { increment: new Prisma.Decimal('7.25') } },
      });
      expect(tx.transaction.create).toHaveBeenCalledTimes(2);
      expect(result.map((transaction) => transaction.amount)).toEqual([
        '7.25',
        '7.25',
      ]);
    });

    it('rejects a transfer when the sender has insufficient funds', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.transfer(owner, transferDto('recipient@example.com', 10)),
      ).rejects.toThrow('Insufficient funds');
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.transaction.create).not.toHaveBeenCalled();
    });

    it('rejects transfers to the same user without accessing the database', async () => {
      await expect(
        service.transfer(owner, transferDto(owner.email, 1)),
      ).rejects.toThrow('Cannot transfer to yourself');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('reports a missing recipient without opening a transaction', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.transfer(owner, transferDto('missing@example.com', 1)),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects invalid amounts before looking up a recipient', async () => {
      await expect(
        service.transfer(owner, transferDto('recipient@example.com', 0)),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('balance and history', () => {
    it('returns a fixed two-decimal balance', async () => {
      prisma.user.findUnique.mockResolvedValue({
        balance: new Prisma.Decimal('12'),
      });

      await expect(service.getBalance(owner.id)).resolves.toEqual({
        balance: '12.00',
      });
    });

    it('reports when the wallet owner does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getBalance(owner.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns only the latest 100 transactions with formatted amounts', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { id: 'transaction-3', amount: new Prisma.Decimal('3') },
      ]);

      const result = await service.getHistory(owner.id);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: owner.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(result[0].amount).toBe('3.00');
    });
  });
});
