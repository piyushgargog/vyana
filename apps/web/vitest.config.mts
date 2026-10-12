import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
      // `server-only` throws outside a React server build; tests run server code directly.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { TINYFISH_MOCK: "1", LLM_MOCK: "1" },
  },
});
