export type ApiOptions = RequestInit & { timeoutMs?: number };

async function request<T>(
  path: string,
  options: ApiOptions | undefined,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  const {
    timeoutMs = path.startsWith('/ml/train/') ? 180_000 : 60_000,
    signal: external,
    ...init
  } = options || {};
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (external?.aborted) abort();
  else external?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      signal: controller.signal,
      headers:
        init.body instanceof FormData
          ? init.headers
          : { 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ detail: 'The server could not complete this request. Please try again.' }));
      throw new Error(
        typeof body.detail === 'string'
          ? body.detail
          : Array.isArray(body.detail)
            ? body.detail.map((x: { msg: string }) => x.msg).join('; ')
            : 'Request failed. Please try again.',
      );
    }
    return await read(response);
  } catch (error) {
    if (timedOut)
      throw new Error('This request timed out. Check that the backend is running, then try again.');
    if (external?.aborted) throw error;
    if (error instanceof TypeError)
      throw new Error('Could not reach the backend. Check your connection and try again.');
    if (error instanceof SyntaxError)
      throw new Error('The server returned an unreadable response. Please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', abort);
  }
}
export function api<T>(path: string, options?: ApiOptions): Promise<T> {
  return request(path, options, (response) => response.json());
}
export function download(path: string, options?: ApiOptions): Promise<Blob> {
  return request(path, options, (response) => response.blob());
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const format = (n: number | null | undefined, digits = 1) =>
  n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits });
