import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
config({ path: resolve(rootDir, ".env") });
config({ path: resolve(rootDir, "server/.env"), override: false });

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`Warm Leads API listening on http://localhost:${port}`);
});
