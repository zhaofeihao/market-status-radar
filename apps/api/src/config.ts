export interface AppConfig {
  port: number;
  requestTimeoutMs: number;
  allowedOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const defaultAllowedOrigins = env.VERCEL ? "" : "http://localhost:5173";

  return {
    port: Number(env.API_PORT ?? 4000),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 8000),
    allowedOrigins: (env.CORS_ALLOWED_ORIGINS ?? defaultAllowedOrigins)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
}
