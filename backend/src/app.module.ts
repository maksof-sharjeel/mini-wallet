import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({
  imports: [StorageModule, AuthModule, TransactionsModule],
})
export class AppModule {}
