import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@perfecto/domain": alias("domain"),
      "@perfecto/contracts": alias("contracts"),
      "@perfecto/application": alias("application")
    }
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "packages/*/test/**/*.test.tsx"],
    environment: "node"
  }
});
