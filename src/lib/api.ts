export const getBaseApiUrl = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEST_API_URL || 'http://api:3001';
  }
  return process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3001';
};

export async function apiFetch(endpoint: string, init?: RequestInit) {
  const baseUrl = getBaseApiUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return fetch(`${baseUrl}${cleanEndpoint}`, init);
}
