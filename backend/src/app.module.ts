import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({
  imports: [PrismaModule, AuthModule, TransactionsModule],
})
export class AppModule {}
