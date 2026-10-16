import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TransferDto {
  @IsEmail()
  recipientEmail!: string;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(9999999999.99)
  amount!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  description!: string;
}
