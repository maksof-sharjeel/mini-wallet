import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import {
  WALLET_STORAGE,
  type WalletStorage,
} from '../storage/wallet-storage.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(WALLET_STORAGE) private readonly storage: WalletStorage,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.storage.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.storage.createUser(
      dto.email,
      await hash(dto.password, 10),
    );
    const safeUser = { id: user.id, email: user.email };
    return {
      user: safeUser,
      accessToken: this.createToken(safeUser.id, safeUser.email),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.storage.findUserByEmail(dto.email);
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const safeUser = { id: user.id, email: user.email };
    return {
      user: safeUser,
      accessToken: this.createToken(safeUser.id, safeUser.email),
    };
  }

  private createToken(id: string, email: string): string {
    return this.jwt.sign({ sub: id, email });
  }
}
