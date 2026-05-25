export interface AppConfig {
  port: number;
  requestTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.API_PORT ?? 4000),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 8000)
  };
}
