import { createServer } from "../apps/api/src/server.js";
import { loadConfig } from "../apps/api/src/config.js";
import { createDefaultAdapters } from "../apps/api/src/adapters/index.js";
import { createDefaultTradfiAdapters } from "../apps/api/src/tradfi/index.js";

const config = loadConfig();

export default createServer({
  adapters: createDefaultAdapters(config),
  tradfiAdapters: createDefaultTradfiAdapters(config),
  allowedOrigins: config.allowedOrigins
});
