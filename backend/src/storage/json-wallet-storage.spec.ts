import { BadRequestException } from '@nestjs/common';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonWalletStorage } from './json-wallet-storage.js';

describe('JsonWalletStorage', () => {
  let directory: string;
  let filePath: string;
  let storage: JsonWalletStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mini-wallet-'));
    filePath = join(directory, 'data', 'wallet.json');
    storage = new JsonWalletStorage(filePath);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('persists accounts and transactions so another instance can reload them', async () => {
    const user = await storage.createUser(
      'owner@example.com',
      'already-hashed-password',
    );
    await storage.deposit(user.id, '25.50', 'Tea');
    await storage.deposit(user.id, '0.25', 'Tea biscuits');

    const restartedStorage = new JsonWalletStorage(filePath);

    await expect(restartedStorage.getBalance(user.id)).resolves.toBe('25.75');
    const history = await restartedStorage.getHistory(user.id);
    expect(history).toHaveLength(2);
    expect(history.map((transaction) => transaction.description)).toEqual([
      'Tea biscuits',
      'Tea',
    ]);
    const file = JSON.parse(await readFile(filePath, 'utf8')) as {
      users: Array<{ passwordHash: string }>;
    };
    expect(file.users[0].passwordHash).toBe('already-hashed-password');
  });

  it('keeps old transaction records readable when they do not have descriptions', async () => {
    await mkdir(join(directory, 'data'), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        users: [
          {
            id: 'legacy-user',
            email: 'legacy@example.com',
            passwordHash: 'hash',
            balance: '4.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        transactions: [
          {
            id: 'legacy-transaction',
            userId: 'legacy-user',
            type: 'DEPOSIT',
            amount: '4.00',
            counterpartyId: null,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
      'utf8',
    );

    await expect(storage.getHistory('legacy-user')).resolves.toMatchObject([
      { id: 'legacy-transaction', description: null },
    ]);
  });

  it('serializes simultaneous writes so no deposits are lost', async () => {
    const user = await storage.createUser('owner@example.com', 'hash');

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        storage.deposit(user.id, '0.10', `Deposit ${index}`),
      ),
    );

    await expect(storage.getBalance(user.id)).resolves.toBe('1.00');
    await expect(storage.getHistory(user.id)).resolves.toHaveLength(10);
  });

  it('leaves data unchanged when an insufficient withdrawal fails', async () => {
    const user = await storage.createUser('owner@example.com', 'hash');
    await storage.deposit(user.id, '5.00', 'Starting balance');

    await expect(
      storage.withdraw(user.id, '5.01', 'Overspend attempt'),
    ).rejects.toThrow(BadRequestException);

    await expect(storage.getBalance(user.id)).resolves.toBe('5.00');
    await expect(storage.getHistory(user.id)).resolves.toHaveLength(1);
  });

  it('moves funds and records both sides of a transfer', async () => {
    const sender = await storage.createUser('sender@example.com', 'hash');
    const recipient = await storage.createUser('recipient@example.com', 'hash');
    await storage.deposit(sender.id, '20.00', 'Payday');

    const entries = await storage.transfer(
      sender.id,
      sender.email,
      recipient.email,
      '7.25',
      'Dinner with friends',
    );

    expect(entries.map((entry) => entry.type)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ]);
    expect(entries.map((entry) => entry.description)).toEqual([
      'Dinner with friends',
      'Dinner with friends',
    ]);
    await expect(storage.getBalance(sender.id)).resolves.toBe('12.75');
    await expect(storage.getBalance(recipient.id)).resolves.toBe('7.25');
  });

  it('does not partially transfer if sender funds are insufficient', async () => {
    const sender = await storage.createUser('sender@example.com', 'hash');
    const recipient = await storage.createUser('recipient@example.com', 'hash');

    await expect(
      storage.transfer(
        sender.id,
        sender.email,
        recipient.email,
        '1.00',
        'Dinner',
      ),
    ).rejects.toThrow('Insufficient funds');

    await expect(storage.getBalance(sender.id)).resolves.toBe('0.00');
    await expect(storage.getBalance(recipient.id)).resolves.toBe('0.00');
    await expect(storage.getHistory(sender.id)).resolves.toHaveLength(0);
  });
});
