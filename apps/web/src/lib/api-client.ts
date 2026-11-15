export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  wallet?: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(wallet ? { "x-mwr-wallet": wallet } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Permintaan belum berhasil.");
  return result as T;
}
