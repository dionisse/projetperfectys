import { defineConfig } from "vitest/config";

/**
 * Configuration de test.
 *
 * `environment: "node"` par défaut : le noyau est du métier pur, il n'a pas besoin de DOM et un
 * test qui tourne sans navigateur tourne dix fois plus vite. Les tests d'écran demandent jsdom
 * par un commentaire de docblock en première ligne de fichier.
 */
export default defineConfig({
  test: {
    include: ["compta/test/**/*.test.ts", "compta/test/**/*.test.tsx"],
    environment: "node"
  }
});
