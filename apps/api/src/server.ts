import express from "express";
import cors from "cors";
import type { ExchangeAdapter } from "./adapters/types.js";

export interface ServerOptions {
  adapters: ExchangeAdapter[];
}

export function createServer(_options: ServerOptions) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
