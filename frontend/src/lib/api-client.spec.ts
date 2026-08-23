import { ApiError, apiRequest } from './api-client';

describe('apiRequest', () => {
  it('sends bearer authentication and returns JSON without exposing the token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest<{ ok: boolean }>('/reports/overview', {
        accessToken: 'access-secret',
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://localhost:3000/api/v1/reports/overview');
    expect(new Headers(options?.headers).get('authorization')).toBe(
      'Bearer access-secret',
    );
    expect(String(url)).not.toContain('access-secret');
  });

  it('preserves safe API status and correlation details for authorization errors', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          correlationId: 'corr-forbidden',
          message: 'Forbidden',
          statusCode: 403,
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 403,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await apiRequest('/users').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      correlationId: 'corr-forbidden',
      message: 'Forbidden',
      status: 403,
    });
  });

  it('normalizes network failures without leaking implementation details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('private network detail')),
    );

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      message:
        'No pudimos conectar con DTodoPets. Revisa que la API esté disponible.',
      status: 0,
    });
  });
});

