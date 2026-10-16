import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    if (process.env.STORAGE_MODE !== 'json') {
      await this.$connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
