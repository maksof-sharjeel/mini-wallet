import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JsonWalletStorage } from './json-wallet-storage.js';
import { PrismaWalletStorage } from './prisma-wallet-storage.js';
import { WALLET_STORAGE } from './wallet-storage.js';

const storageMode = process.env.STORAGE_MODE ?? 'json';
if (storageMode !== 'json' && storageMode !== 'postgres') {
  throw new Error('STORAGE_MODE must be either "json" or "postgres"');
}
const useJsonStorage = storageMode === 'json';

@Global()
@Module({
  imports: useJsonStorage ? [] : [PrismaModule],
  providers: [
    ...(useJsonStorage
      ? [
          {
            provide: JsonWalletStorage,
            useFactory: () => new JsonWalletStorage(),
          },
        ]
      : [PrismaWalletStorage]),
    {
      provide: WALLET_STORAGE,
      useFactory: (
        jsonStorage?: JsonWalletStorage,
        prismaStorage?: PrismaWalletStorage,
      ) => (useJsonStorage ? jsonStorage : prismaStorage),
      inject: useJsonStorage ? [JsonWalletStorage] : [PrismaWalletStorage],
    },
  ],
  exports: [WALLET_STORAGE],
})
export class StorageModule {}
