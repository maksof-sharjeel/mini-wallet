import { IsEmail, IsNumber, IsPositive, Max } from 'class-validator';

export class TransferDto {
  @IsEmail()
  recipientEmail!: string;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(9999999999.99)
  amount!: number;
}
