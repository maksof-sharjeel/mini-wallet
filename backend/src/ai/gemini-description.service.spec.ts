import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiDescriptionService } from './gemini-description.service.js';

describe('GeminiDescriptionService', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  let service: GeminiDescriptionService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    service = new GeminiDescriptionService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    fetchSpy.mockRestore();
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  });

  it('rewrites the note and keeps the API key in the server-side header', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Chai aur nashta' }] } }],
        }),
        { status: 200 },
      ),
    );

    await expect(service.rewrite('chai wagea')).resolves.toBe(
      'Chai aur nashta',
    );

    const [url, options] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toContain('models/gemini-flash-latest:generateContent');
    expect(options.headers['x-goog-api-key']).toBe('test-api-key');
    expect(JSON.stringify(options.body)).toContain('chai wagea');
  });

  it('fails clearly when the API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(service.rewrite('chai')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports Gemini API failures instead of returning an unedited note', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Model is not available for this API key.' },
        }),
        { status: 404 },
      ),
    );

    await expect(service.rewrite('chai')).rejects.toThrow(
      'Gemini could not rewrite this description (HTTP 404): Model is not available for this API key.',
    );
  });

  it('retries a temporary 503 and succeeds when Gemini recovers', async () => {
    jest.useFakeTimers();
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'This model is currently experiencing high demand.',
            },
          }),
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Chai' }] } }],
          }),
          { status: 200 },
        ),
      );

    const result = service.rewrite('chai');
    await jest.runAllTimersAsync();

    await expect(result).resolves.toBe('Chai');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('stops after three attempts and returns a retryable 503 error', async () => {
    jest.useFakeTimers();
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              message: 'This model is currently experiencing high demand.',
            },
          }),
          { status: 503 },
        ),
      ),
    );

    const result = service.rewrite('chai');
    const rejection = expect(result).rejects.toThrow(
      'Gemini could not rewrite this description (HTTP 503): This model is currently experiencing high demand. Gemini is temporarily busy; please try again shortly.',
    );
    await jest.runAllTimersAsync();

    await rejection;
    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('does not retry a permanent model error', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Model not found.' } }), {
        status: 404,
      }),
    );

    await expect(service.rewrite('chai')).rejects.toThrow(BadGatewayException);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty Gemini response', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [] } }] }),
        { status: 200 },
      ),
    );

    await expect(service.rewrite('chai')).rejects.toThrow(BadGatewayException);
  });
});
