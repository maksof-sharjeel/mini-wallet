import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface GeminiErrorResponse {
  error?: {
    message?: string;
  };
}

const GEMINI_MODEL = 'gemini-flash-latest';
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

@Injectable()
export class GeminiDescriptionService {
  async rewrite(description: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Gemini AI is not configured. Set GEMINI_API_KEY in the backend .env file.',
      );
    }

    let response: Response | undefined;
    let providerMessage: string | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: [
                        'Rewrite the user-provided wallet transaction note as one short, clear description.',
                        'Keep the same language as the input.',
                        'Preserve the meaning and do not invent details or infer a category that is not stated.',
                        'Return only the rewritten description, without quotes or explanation.',
                        `User description: ${JSON.stringify(description)}`,
                      ].join('\n'),
                    },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 80,
                temperature: 0.2,
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
      } catch {
        throw new ServiceUnavailableException(
          'Could not connect to Gemini. Check the internet connection and try again.',
        );
      }

      if (response.ok) break;

      providerMessage = await this.getProviderMessage(response);
      if (
        !RETRYABLE_STATUSES.has(response.status) ||
        attempt === MAX_ATTEMPTS - 1
      ) {
        const suffix = providerMessage ? `: ${providerMessage}` : '';
        const message = `Gemini could not rewrite this description (HTTP ${response.status})${suffix}`;
        if (response.status === 429 || response.status === 503) {
          throw new ServiceUnavailableException(
            `${message}. Gemini is temporarily busy; please try again shortly.`,
          );
        }
        throw new BadGatewayException(`${message}.`);
      }

      await this.pause(this.retryDelay(response, attempt));
    }

    if (!response?.ok) {
      throw new ServiceUnavailableException(
        'Gemini is temporarily unavailable. Please try again shortly.',
      );
    }

    let result: GeminiResponse;
    try {
      result = (await response.json()) as GeminiResponse;
    } catch {
      throw new BadGatewayException(
        'Gemini returned an invalid response. Please try again.',
      );
    }
    const rewritten = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!rewritten) {
      throw new BadGatewayException(
        'Gemini returned an empty description. Please try again.',
      );
    }
    if (rewritten.length > 300) {
      throw new BadGatewayException(
        'Gemini returned a description that is too long. Please try again.',
      );
    }
    return rewritten;
  }

  private async getProviderMessage(
    response: Response,
  ): Promise<string | undefined> {
    try {
      const errorBody = (await response.json()) as GeminiErrorResponse;
      return errorBody.error?.message?.trim().replace(/[.!?]+$/, '');
    } catch {
      return undefined;
    }
  }

  private retryDelay(response: Response, attempt: number): number {
    const retryAfter = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, 5000);
    }
    return 750 * 2 ** attempt;
  }

  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
