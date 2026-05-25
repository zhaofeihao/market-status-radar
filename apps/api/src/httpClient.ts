export interface JsonHttpClient {
  getJson<T = unknown>(url: string, options?: { headers?: Record<string, string> }): Promise<T>;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export function createJsonHttpClient(timeoutMs: number): JsonHttpClient {
  return {
    async getJson<T = unknown>(url: string, options?: { headers?: Record<string, string> }): Promise<T> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: { accept: "application/json", ...options?.headers },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new HttpError(`HTTP ${response.status} for ${url}`, response.status);
        }

        return (await response.json()) as T;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
