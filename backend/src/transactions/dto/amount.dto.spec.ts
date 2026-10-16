import { ValidationPipe } from '@nestjs/common';
import { AmountDto } from './amount.dto.js';

describe('AmountDto request validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('accepts a description along with the transaction amount', async () => {
    const result = await pipe.transform(
      { amount: 12.5, description: '  chai wagea  ' },
      { type: 'body', metatype: AmountDto },
    );

    expect(result).toMatchObject({
      amount: 12.5,
      description: 'chai wagea',
    });
  });

  it('continues rejecting request properties without DTO validation rules', async () => {
    await expect(
      pipe.transform(
        { amount: 12.5, description: 'chai wagea', unexpected: true },
        { type: 'body', metatype: AmountDto },
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['property unexpected should not exist'],
        statusCode: 400,
      },
    });
  });
});
