import express from "express";
import cors from "cors";
import type { ExchangeAdapter } from "./adapters/types.js";
import { searchCoinAcrossExchanges } from "./services/searchService.js";
import type { SearchCredentials } from "@status-monitor/shared";
import type { TradfiMarketAdapter } from "./tradfi/types.js";
import { searchTradfiAcrossExchanges } from "./tradfi/searchService.js";

export interface ServerOptions {
  adapters: ExchangeAdapter[];
  tradfiAdapters?: TradfiMarketAdapter[];
}

export function createServer(options: ServerOptions) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/exchanges", (_req, res) => {
    res.json(options.adapters.map(({ id, name }) => ({ id, name })));
  });

  app.get("/api/search", async (req, res, next) => {
    try {
      const coin = typeof req.query.coin === "string" ? req.query.coin : "";
      if (coin.trim().length === 0) {
        res.status(400).json({ error: "coin query parameter is required" });
        return;
      }

      res.json(await searchCoinAcrossExchanges(coin, options.adapters));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/tradfi/search", async (req, res, next) => {
    try {
      const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
      if (symbol.trim().length === 0) {
        res.status(400).json({ error: "symbol query parameter is required" });
        return;
      }

      res.json(await searchTradfiAcrossExchanges(symbol, options.tradfiAdapters ?? []));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/search", async (req, res, next) => {
    try {
      const body = req.body as { coin?: unknown; credentials?: SearchCredentials };
      const coin = typeof body.coin === "string" ? body.coin : "";
      if (coin.trim().length === 0) {
        res.status(400).json({ error: "coin is required" });
        return;
      }

      res.json(await searchCoinAcrossExchanges(coin, options.adapters, body.credentials));
    } catch (error) {
      next(error);
    }
  });

  return app;
}
