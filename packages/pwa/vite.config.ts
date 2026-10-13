import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const alias = (name: string) => fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@perfecto/domain": alias("domain"),
      "@perfecto/contracts": alias("contracts"),
      "@perfecto/application": alias("application")
    }
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
});
