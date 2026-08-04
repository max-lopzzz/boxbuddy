import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      // Vitest runs test files directly under Node, without Next.js's webpack
      // pass that aliases `server-only` to a no-op for server bundles. Since
      // our tests exercise server-side modules (e.g. lib/supabase.ts), alias
      // it here the same way Next.js does for the server compilation target.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
});
