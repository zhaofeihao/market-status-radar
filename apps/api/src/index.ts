import { createServer } from "./server.js";
import { loadConfig } from "./config.js";
import { createDefaultAdapters } from "./adapters/index.js";
import { createDefaultTradfiAdapters } from "./tradfi/index.js";

const config = loadConfig();
const app = createServer({ adapters: createDefaultAdapters(config), tradfiAdapters: createDefaultTradfiAdapters(config) });

app.listen(config.port, () => {
  console.log(`Exchange status API listening on http://localhost:${config.port}`);
});
