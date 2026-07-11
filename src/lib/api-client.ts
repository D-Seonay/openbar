const API_URL = process.env.NEST_API_URL ?? "http://localhost:3001";

export async function apiLogin(
  username: string,
  password: string,
): Promise<{ token: string } | null> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/bardenoa_session=([^;]+)/);
  if (!match) return null;

  return { token: match[1] };
}
