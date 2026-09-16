import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // See src/test/server-only-stub.ts: the real package throws on import
      // outside a server component, which is the point in production and a
      // blocker in a test runner.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
