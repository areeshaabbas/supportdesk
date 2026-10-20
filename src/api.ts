export async function request<T = any>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data =
    res.status === 204
      ? null
      : await res.json().catch(() => ({
          error: "The server is unavailable. Check that the API is running.",
        }));
  if (!res.ok)
    throw new Error(data?.error || "Unable to complete your request.");
  return data;
}
