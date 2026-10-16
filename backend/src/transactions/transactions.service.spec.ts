import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GeminiDescriptionService } from '../ai/gemini-description.service.js';
import type { WalletStorage } from '../storage/wallet-storage.js';
import { TransactionsService } from './transactions.service.js';

const owner = { id: 'user-1', email: 'owner@example.com' };
const amountDto = (amount: number) => ({ amount });

describe('TransactionsService', () => {
  let service: TransactionsService;
  let storage: jest.Mocked<WalletStorage>;
  let gemini: Pick<GeminiDescriptionService, 'rewrite'> & {
    rewrite: jest.Mock;
  };

  beforeEach(() => {
    storage = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
      getBalance: jest.fn(),
      getHistory: jest.fn(),
      deposit: jest.fn(),
      withdraw: jest.fn(),
      transfer: jest.fn(),
    };
    gemini = { rewrite: jest.fn().mockResolvedValue('Polished description') };
    service = new TransactionsService(storage, gemini);
  });

  describe('deposit', () => {
    it('stores a valid deposit amount with two decimal places', async () => {
      storage.deposit.mockResolvedValue({
        id: 'transaction-1',
        userId: owner.id,
        type: 'DEPOSIT',
        amount: '25.50',
        description: 'Tea',
        counterpartyId: null,
        createdAt: new Date().toISOString(),
      });

      const result = await service.deposit(owner, {
        ...amountDto(25.5),
        description: '  tea wagea  ',
      });

      expect(gemini.rewrite).toHaveBeenCalledWith('tea wagea');
      expect(storage.deposit).toHaveBeenCalledWith(
        owner.id,
        '25.50',
        'Polished description',
      );
      expect(result.amount).toBe('25.50');
    });

    it.each([0, -1, 1.239, Number.NaN, Number.POSITIVE_INFINITY, 10000000000])(
      'rejects invalid amount %s without accessing storage',
      async (amount) => {
        await expect(
          service.deposit(owner, {
            ...amountDto(amount),
            description: 'tea',
          }),
        ).rejects.toThrow(BadRequestException);
        expect(storage.deposit).not.toHaveBeenCalled();
        expect(gemini.rewrite).not.toHaveBeenCalled();
      },
    );
  });

  describe('withdraw', () => {
    it('stores a valid withdrawal', async () => {
      storage.withdraw.mockResolvedValue({
        id: 'transaction-2',
        userId: owner.id,
        type: 'WITHDRAW',
        amount: '10.00',
        description: 'Lunch',
        counterpartyId: null,
        createdAt: new Date().toISOString(),
      });

      const result = await service.withdraw(owner, {
        ...amountDto(10),
        description: 'lunch',
      });

      expect(storage.withdraw).toHaveBeenCalledWith(
        owner.id,
        '10.00',
        'Polished description',
      );
      expect(result.amount).toBe('10.00');
    });

    it('rejects insufficient funds returned by storage', async () => {
      storage.withdraw.mockRejectedValue(
        new BadRequestException('Insufficient funds'),
      );

      await expect(
        service.withdraw(owner, { ...amountDto(10), description: 'lunch' }),
      ).rejects.toThrow('Insufficient funds');
    });

    it('does not save a transaction if Gemini cannot rewrite the description', async () => {
      gemini.rewrite.mockRejectedValue(new Error('Gemini unavailable'));

      await expect(
        service.withdraw(owner, { ...amountDto(10), description: 'lunch' }),
      ).rejects.toThrow('Gemini unavailable');
      expect(storage.withdraw).not.toHaveBeenCalled();
    });

    it('rejects invalid amounts before calling storage', async () => {
      await expect(
        service.withdraw(owner, {
          ...amountDto(-0.01),
          description: 'lunch',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.withdraw).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    const transferDto = (recipientEmail: string, amount: number) => ({
      recipientEmail,
      amount,
    });

    it('asks storage to transfer normalized funds for both users', async () => {
      storage.transfer.mockResolvedValue([
        {
          id: 'out-1',
          userId: owner.id,
          type: 'TRANSFER_OUT',
          amount: '7.25',
          description: 'Dinner',
          counterpartyId: 'user-2',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'in-1',
          userId: 'user-2',
          type: 'TRANSFER_IN',
          amount: '7.25',
          description: 'Dinner',
          counterpartyId: owner.id,
          createdAt: new Date().toISOString(),
        },
      ]);

      const result = await service.transfer(owner, {
        recipientEmail: 'recipient@example.com',
        amount: 7.25,
        description: 'shared dinner',
      });

      expect(gemini.rewrite).toHaveBeenCalledWith('shared dinner');
      expect(storage.transfer).toHaveBeenCalledWith(
        owner.id,
        owner.email,
        'recipient@example.com',
        '7.25',
        'Polished description',
      );
      expect(result.map((transaction) => transaction.amount)).toEqual([
        '7.25',
        '7.25',
      ]);
    });

    it('rejects insufficient balance returned by storage', async () => {
      storage.transfer.mockRejectedValue(
        new BadRequestException('Insufficient funds'),
      );

      await expect(
        service.transfer(owner, {
          ...transferDto('recipient@example.com', 10),
          description: 'dinner',
        }),
      ).rejects.toThrow('Insufficient funds');
    });

    it('rejects transfers to the same user', async () => {
      storage.transfer.mockRejectedValue(
        new BadRequestException('Cannot transfer to yourself'),
      );

      await expect(
        service.transfer(owner, {
          ...transferDto(owner.email, 1),
          description: 'dinner',
        }),
      ).rejects.toThrow('Cannot transfer to yourself');
    });

    it('reports a missing recipient returned by storage', async () => {
      storage.transfer.mockRejectedValue(
        new NotFoundException('Recipient not found'),
      );

      await expect(
        service.transfer(owner, {
          ...transferDto('missing@example.com', 1),
          description: 'dinner',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid amount before attempting a transfer', async () => {
      await expect(
        service.transfer(owner, {
          ...transferDto('recipient@example.com', 0),
          description: 'dinner',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.transfer).not.toHaveBeenCalled();
    });
  });

  describe('balance and history', () => {
    it('returns the persisted wallet balance', async () => {
      storage.getBalance.mockResolvedValue('12.00');

      await expect(service.getBalance(owner.id)).resolves.toEqual({
        balance: '12.00',
      });
    });

    it('reports when the wallet owner does not exist', async () => {
      storage.getBalance.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(service.getBalance(owner.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the latest transaction history from storage', async () => {
      const transactions = [
        {
          id: 'transaction-3',
          userId: owner.id,
          type: 'DEPOSIT' as const,
          amount: '3.00',
          description: 'Tea',
          counterpartyId: null,
          createdAt: new Date().toISOString(),
        },
      ];
      storage.getHistory.mockResolvedValue(transactions);

      await expect(service.getHistory(owner.id)).resolves.toEqual(transactions);
      expect(storage.getHistory).toHaveBeenCalledWith(owner.id);
    });
  });
});
