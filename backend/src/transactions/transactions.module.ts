import { Module } from '@nestjs/common';
import { GeminiDescriptionService } from '../ai/gemini-description.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

@Module({
  imports: [StorageModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, GeminiDescriptionService],
})
export class TransactionsModule {}
