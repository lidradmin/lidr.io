import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The OAuth provider imports this Workers-only module; tests run in Node.
      "cloudflare:workers": fileURLToPath(new URL("./workers/blog-mcp/src/test-stubs/cloudflare-workers.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts", "workers/**/*.test.ts"],
    testTimeout: 30_000,
    server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
  },
});
