import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

/**
 * Identifiant de déploiement, injecté dans le code client : il versionne le cache et permet de
 * vérifier qu'un déploiement a bien remplacé le précédent.
 */
function identifiantDeBuild(): string {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commit && commit.length > 0) {
    return commit.slice(0, 12);
  }
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export default defineConfig({
  plugins: [preact()],
  base: "/",
  define: {
    __BUILD_ID__: JSON.stringify(identifiantDeBuild())
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true
  },
  server: {
    // L'aperçu passe par un hôte mandataire : il faut écouter sur toutes les interfaces et
    // accepter n'importe quel nom d'hôte, sinon l'aperçu renvoie une fin de non-recevoir.
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
