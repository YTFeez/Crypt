import { getApiUrl } from "./server-mode";

const TOKEN_KEY = "crypt-api-token";

export function getApiToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setApiToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.auth !== false) {
    const t = getApiToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(`${getApiUrl()}${path}`, { ...init, headers });
  let body = {} as { error?: string } & T;
  try {
    body = (await res.json()) as { error?: string } & T;
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    return { error: body.error ?? `Erreur ${res.status}`, status: res.status };
  }
  return { data: body as T, status: res.status };
}
