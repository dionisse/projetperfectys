import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const alias = (name: string) => fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url));

/**
 * Identifiant de déploiement, injecté dans le code client.
 *
 * Vercel expose le commit déployé ; en local on horodate. Cet identifiant versionne
 * le cache du service worker (`sw.js?v=…`) : chaque déploiement remplace la coquille
 * précédente au lieu de la laisser en cache.
 */
function buildId(): string {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commit && commit.length > 0) {
    return commit.slice(0, 12);
  }
  const deployment = process.env.VERCEL_DEPLOYMENT_ID;
  if (deployment && deployment.length > 0) {
    return deployment;
  }
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export default defineConfig({
  plugins: [preact()],
  // Chemins absolus : le site est servi à la racine du domaine Vercel.
  base: "/",
  define: {
    __PERFECTO_BUILD_ID__: JSON.stringify(buildId())
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // Les moteurs Excel/PDF arrivent en chargement différé : gardons l'œil sur le poids.
    chunkSizeWarningLimit: 1000
  },
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
