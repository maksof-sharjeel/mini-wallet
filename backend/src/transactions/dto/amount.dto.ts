import { IsNumber, IsPositive, Max } from 'class-validator';

export class AmountDto {
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(9999999999.99)
  amount!: number;
}
