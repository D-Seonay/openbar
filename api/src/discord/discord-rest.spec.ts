import { discordFetch } from './discord-rest';

/**
 * `discordFetch` reads its config at module scope, so the token is set before
 * the module is exercised and `fetch` is replaced wholesale.
 */
const originalFetch = global.fetch;

function respond(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe('discordFetch', () => {
  beforeAll(() => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('retries a 429 and succeeds, instead of reporting a failure', async () => {
    const fetchMock = jest
      .fn()
      // retry_after in seconds, as Discord sends it.
      .mockResolvedValueOnce(respond(429, { retry_after: 0.01 }))
      .mockResolvedValueOnce(respond(200, { id: 'ok' }));
    global.fetch = fetchMock;

    await expect(discordFetch('/x', { method: 'POST' })).resolves.toEqual({
      id: 'ok',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the Retry-After header when the body has no delay', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(respond(429, {}, { 'retry-after': '0.01' }))
      .mockResolvedValueOnce(respond(200, { id: 'ok' }));
    global.fetch = fetchMock;

    await expect(discordFetch('/x', { method: 'POST' })).resolves.toEqual({
      id: 'ok',
    });
  });

  it('gives up after repeated 429s rather than retrying forever', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(respond(429, { retry_after: 0.001 }));
    global.fetch = fetchMock;

    await expect(discordFetch('/x', { method: 'POST' })).resolves.toBeNull();
    // Three retries on top of the first attempt.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry a permanent refusal', async () => {
    // 403 is "this user closed their DMs" — trying again changes nothing.
    const fetchMock = jest.fn().mockResolvedValue(respond(403, {}));
    global.fetch = fetchMock;

    await expect(discordFetch('/x', { method: 'POST' })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null rather than throwing when the network fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(discordFetch('/x', { method: 'POST' })).resolves.toBeNull();
  });
});
