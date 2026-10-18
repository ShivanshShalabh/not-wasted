import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // "server-only" throws outside a React Server build; tests import server modules directly.
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "src/lib/public-data/server-only.stub.ts") } },
  test: { include: ["src/**/*.test.ts"] },
});
