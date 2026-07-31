/**
 * Base URL for server-side calls to the Nest API.
 *
 * Server-side by design. In the browser this returns "" so that anything built
 * on top of it stays same-origin and goes through the `/uploads/*` rewrite in
 * next.config.ts — a NEXT_PUBLIC_* API address would be inlined into the bundle
 * at build time and pin it to whichever host it was built for.
 */
export const getBaseApiUrl = (): string => {
  if (typeof window !== 'undefined') return '';
  return process.env.NEST_API_URL || 'http://api:3001';
};

export async function apiFetch(endpoint: string, init?: RequestInit) {
  const baseUrl = getBaseApiUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return fetch(`${baseUrl}${cleanEndpoint}`, init);
}
