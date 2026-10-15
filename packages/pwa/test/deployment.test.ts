/**
 * Contrat de déploiement Vercel.
 *
 * Ces vérifications existent parce qu'un site « publié mais blanc » ne se voit pas
 * dans les tests fonctionnels : il vient d'un build introuvable, d'un asset 404, d'un
 * service worker qui fige une coquille cassée ou d'un `npm ci` qui n'installe pas une
 * dépendance absente du lockfile. Chaque règle ci-dessous correspond à une de ces pannes.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const DIST = join(ROOT, "packages/pwa/dist");
const built = existsSync(join(DIST, "index.html"));

type VercelConfig = {
  framework: string | null;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  rewrites?: { source: string; destination: string }[];
  headers?: { source: string; headers: { key: string; value: string }[] }[];
  build?: { env?: Record<string, string> };
};

let config: VercelConfig;

beforeAll(() => {
  config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as VercelConfig;
});

/**
 * `"/assets/(.*)"` → expression rationnelle ancrée, comme le fait Vercel.
 *
 * Les groupes déjà écrits par l'auteur de la configuration sont conservés tels quels ;
 * seul le texte littéral est échappé (`*` devient un groupe capturant, `:nom` un segment).
 */
function patternToRegExp(source: string): RegExp {
  const body = source
    .split(/(\([^)]*\))/g)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part
            .replace(/[.+^${}|[\]\\]/g, "\\$&")
            .replace(/\*/g, "(.*)")
            .replace(/:([A-Za-z_][\w-]*)/g, "[^/]+")
    )
    .join("");
  return new RegExp(`^${body}$`);
}

function headersFor(pathname: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of config.headers ?? []) {
    if (patternToRegExp(rule.source).test(pathname)) {
      for (const header of rule.headers) out[header.key] = header.value;
    }
  }
  return out;
}

describe("vercel.json : le build monorepo est explicite", () => {
  it("désactive la détection automatique et vise le bon dossier de sortie", () => {
    // Sans `framework: null`, Vercel lance `vite build` à la racine du monorepo,
    // là où il n'y a ni index.html ni configuration Vite : le build échoue.
    expect(config.framework).toBeNull();
    expect(config.buildCommand).toBe("npm run build:pwa");
    expect(config.outputDirectory).toBe("packages/pwa/dist");
    expect(config.installCommand).toBe("npm ci --no-audit --no-fund");
    expect(config.build?.env?.NODE_VERSION).toMatch(/^2[0-9]/);
  });

  it("déclare une sortie Vite cohérente avec le dossier publié", () => {
    const viteConfig = readFileSync(join(ROOT, "packages/pwa/vite.config.ts"), "utf8");
    expect(viteConfig).toContain('outDir: "dist"');
    expect(viteConfig).toContain('base: "/"');
    // L'identifiant de build versionne le cache du service worker.
    expect(viteConfig).toContain("__PERFECTO_BUILD_ID__");
    expect(viteConfig).toContain("VERCEL_GIT_COMMIT_SHA");
  });

  it("réécrit tout chemin inconnu vers la coquille SPA", () => {
    const rewrites = config.rewrites ?? [];
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]).toEqual({ source: "/(.*)", destination: "/index.html" });
  });

  it("ne met jamais en cache ce qui doit suivre un déploiement", () => {
    for (const path of ["/index.html", "/sw.js", "/manifest.webmanifest"]) {
      expect(headersFor(path)["Cache-Control"]).toBe("public, max-age=0, must-revalidate");
    }
    // Les assets hachés par Vite sont immuables : un an de cache sans risque.
    expect(headersFor("/assets/index-ABC123.js")["Cache-Control"]).toContain("immutable");
    expect(headersFor("/sw.js")["Service-Worker-Allowed"]).toBe("/");
  });

  it("reste intégrable dans un iframe de prévisualisation", () => {
    // Un en-tête de cadrage casserait l'aperçu Arena (origine différente).
    const flat = JSON.stringify(config.headers ?? []).toLowerCase();
    expect(flat).not.toContain("x-frame-options");
    expect(flat).not.toContain("frame-ancestors");
  });

  it("n'envoie pas sur Vercel ce qui ne sert pas au site", () => {
    const ignore = readFileSync(join(ROOT, ".vercelignore"), "utf8");
    expect(ignore).toContain("legacy/");
    expect(ignore).toContain("*.zip");
  });
});

describe("lockfile : `npm ci` installe bien tout le nécessaire", () => {
  it("contient chaque dépendance déclarée par les espaces de travail", () => {
    const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    const locked = Object.keys(lock.packages);
    const workspaces = readdirSync(join(ROOT, "packages")).filter((name) =>
      existsSync(join(ROOT, "packages", name, "package.json"))
    );

    expect(workspaces.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const workspace of workspaces) {
      const manifest = JSON.parse(
        readFileSync(join(ROOT, "packages", workspace, "package.json"), "utf8")
      ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      for (const name of [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {})
      ]) {
        if (!locked.some((key) => key.endsWith(`node_modules/${name}`))) {
          missing.push(`${workspace}: ${name}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

describe("service worker : jamais d'écran blanc figé", () => {
  const source = readFileSync(join(ROOT, "packages/pwa/public/sw.js"), "utf8");

  it("versionne son cache depuis l'identifiant de déploiement", () => {
    expect(source).toContain('searchParams.get("v")');
    expect(source).toContain("perfecto-next-${VERSION}");
    // Un nom de cache constant laisserait la coquille d'un déploiement précédent.
    expect(source).not.toMatch(/CACHE\s*=\s*"perfecto-next-v\d+"/);
    expect(source).toContain("caches.delete");
    expect(source).toContain("skipWaiting");
    expect(source).toContain("clients.claim");
  });

  it("refuse de mettre en cache une réponse en échec", () => {
    expect(source).toContain("response.ok");
    expect(source).toContain('response.type === "basic"');
  });

  it("prévoit une coquille de secours et repart du réseau en navigation", () => {
    expect(source).toContain('caches.match("./index.html")');
    expect(source).toContain('request.mode === "navigate"');
  });

  it("est enregistré de façon non bloquante par l'application", () => {
    const main = readFileSync(join(ROOT, "packages/pwa/src/main.tsx"), "utf8");
    expect(main).toContain("./sw.js?v=");
    expect(main).toContain(".catch(");
    expect(main).toContain("import.meta.env.PROD");
  });
});

describe("build publié", () => {
  it.skipIf(!built)("produit une coquille dont toutes les références existent", () => {
    const html = readFileSync(join(DIST, "index.html"), "utf8");
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]!);

    expect(references.length).toBeGreaterThan(3);
    for (const reference of references) {
      const relative = reference.replace(/^\//, "");
      expect(existsSync(join(DIST, relative)), `référence manquante : ${reference}`).toBe(true);
    }
    // Le module applicatif est bien présent et haché.
    expect(html).toMatch(/\/assets\/index-[\w-]+\.js/);
  });

  it.skipIf(!built)("embarque l'enregistrement versionné du service worker", () => {
    // Le module d'entrée, tel qu'index.html le cite : c'est lui qui enregistre le
    // service worker. Les moteurs Excel et PDF sont découpés en morceaux chargés à la
    // demande, qui ne contiennent évidemment pas cet enregistrement.
    const html = readFileSync(join(DIST, "index.html"), "utf8");
    const bundle = /\/assets\/(index-[\w-]+\.js)/.exec(html)?.[1];
    expect(bundle, "module d'entrée introuvable dans index.html").toBeDefined();
    const code = readFileSync(join(DIST, "assets", bundle!), "utf8");

    expect(code).toContain("sw.js?v=");
    // L'identifiant de build a bien été substitué à la compilation.
    expect(code).not.toContain("__PERFECTO_BUILD_ID__");
  });

  it.skipIf(!built)("publie le manifeste, le worker et les icônes", () => {
    for (const file of ["sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"]) {
      expect(existsSync(join(DIST, file)), `${file} manquant`).toBe(true);
    }
    const manifest = JSON.parse(readFileSync(join(DIST, "manifest.webmanifest"), "utf8")) as {
      start_url: string;
      icons: { src: string }[];
    };
    expect(manifest.start_url).toBe("./");
    for (const icon of manifest.icons) {
      expect(existsSync(join(DIST, icon.src)), `icône manquante : ${icon.src}`).toBe(true);
    }
  });

  it.skipIf(!built)("sert un lien profond comme la coquille, et un asset comme lui-même", () => {
    // Même règle que Vercel : le fichier d'abord, la réécriture ensuite.
    const route = (pathname: string): string => {
      const candidate = join(DIST, pathname.replace(/^\//, ""));
      if (existsSync(candidate)) return pathname;
      const rewrite = (config.rewrites ?? []).find((rule) => patternToRegExp(rule.source).test(pathname));
      return rewrite ? rewrite.destination : "404";
    };

    expect(route("/")).toBe("/");
    expect(route("/sw.js")).toBe("/sw.js");
    expect(route("/comptabilite/pieces")).toBe("/index.html");
    expect(route("/comptabilite/editions")).toBe("/index.html");
    expect(route("/inconnu")).toBe("/index.html");
    expect(route("/assets/absent.js")).toBe("/index.html");
  });
});
