import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GeminiDescriptionService } from '../ai/gemini-description.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import {
  WALLET_STORAGE,
  type WalletStorage,
} from '../storage/wallet-storage.js';
import type { AmountDto } from './dto/amount.dto.js';
import type { TransferDto } from './dto/transfer.dto.js';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(WALLET_STORAGE) private readonly storage: WalletStorage,
    @Inject(GeminiDescriptionService)
    private readonly gemini: Pick<GeminiDescriptionService, 'rewrite'>,
  ) {}

  async getBalance(userId: string) {
    return { balance: await this.storage.getBalance(userId) };
  }

  async getHistory(userId: string) {
    return this.storage.getHistory(userId);
  }

  async deposit(user: AuthUser, dto: AmountDto) {
    const amount = this.parseAmount(dto.amount).toFixed(2);
    const description = await this.gemini.rewrite(dto.description.trim());
    return this.storage.deposit(user.id, amount, description);
  }

  async withdraw(user: AuthUser, dto: AmountDto) {
    const amount = this.parseAmount(dto.amount).toFixed(2);
    const description = await this.gemini.rewrite(dto.description.trim());
    return this.storage.withdraw(user.id, amount, description);
  }

  async transfer(user: AuthUser, dto: TransferDto) {
    const amount = this.parseAmount(dto.amount).toFixed(2);
    const description = await this.gemini.rewrite(dto.description.trim());
    return this.storage.transfer(
      user.id,
      user.email,
      dto.recipientEmail,
      amount,
      description,
    );
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
