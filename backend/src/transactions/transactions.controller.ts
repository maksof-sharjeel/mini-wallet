import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AmountDto } from './dto/amount.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { TransactionsService } from './transactions.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('wallet/balance')
  getBalance(@CurrentUser() user: AuthUser) {
    return this.transactions.getBalance(user.id);
  }

  @Get('transactions')
  getHistory(@CurrentUser() user: AuthUser) {
    return this.transactions.getHistory(user.id);
  }

  @Post('transactions/deposit')
  deposit(@CurrentUser() user: AuthUser, @Body() dto: AmountDto) {
    return this.transactions.deposit(user, dto);
  }

  @Post('transactions/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Body() dto: AmountDto) {
    return this.transactions.withdraw(user, dto);
  }

  @Post('transactions/transfer')
  transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferDto) {
    return this.transactions.transfer(user, dto);
  }
}
