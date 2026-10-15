/**
 * Serveur de prévisualisation « à la Vercel ».
 *
 * Il lit `vercel.json` (dossier de sortie, réécritures, en-têtes) et sert le build de
 * production exactement comme le ferait un déploiement Vercel :
 *   1. un fichier existant est servi tel quel ;
 *   2. sinon la réécriture SPA renvoie `index.html` (aucun 404 sur un lien profond) ;
 *   3. les en-têtes `Cache-Control` déclarés sont appliqués.
 *
 * Usage : `npm run build:pwa && npm run preview:vercel` — puis ouvrir le port 5173.
 * Ce script n'est pas livré : c'est un outil de vérification du contrat de déploiement.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT ?? 5173);

const config = JSON.parse(await readFile(join(ROOT, "vercel.json"), "utf8"));
const OUTPUT = resolve(ROOT, config.outputDirectory ?? "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2"
};

/**
 * `"/assets/(.*)"` → expression rationnelle ancrée, comme le fait Vercel.
 * Les groupes écrits dans la configuration sont conservés ; le littéral est échappé.
 */
function patternToRegExp(source) {
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

const REWRITES = (config.rewrites ?? []).map((rule) => ({
  test: patternToRegExp(rule.source),
  destination: rule.destination
}));

const HEADERS = (config.headers ?? []).map((rule) => ({
  test: patternToRegExp(rule.source),
  headers: rule.headers
}));

function headersFor(pathname) {
  const out = {};
  for (const rule of HEADERS) {
    if (rule.test.test(pathname)) {
      for (const header of rule.headers) out[header.key] = header.value;
    }
  }
  return out;
}

/** Chemin sûr : jamais d'échappement hors du dossier de sortie. */
function toFilePath(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0] ?? "/");
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const full = resolve(OUTPUT, relative);
  if (full !== OUTPUT && !full.startsWith(OUTPUT + sep)) return null;
  return full;
}

async function findFile(pathname) {
  const candidate = toFilePath(pathname);
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      const indexInfo = await stat(index);
      return indexInfo.isFile() ? index : null;
    }
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

  try {
    // 1. Fichier existant d'abord (le comportement de Vercel).
    let file = await findFile(pathname);
    let servedPath = pathname;

    // 2. Sinon, réécriture SPA vers la coquille.
    if (!file) {
      const rewrite = REWRITES.find((rule) => rule.test.test(pathname));
      if (rewrite) {
        file = await findFile(rewrite.destination);
        servedPath = rewrite.destination;
      }
    }

    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("404 — introuvable\n");
      console.log(`404  ${pathname}`);
      return;
    }

    const body = await readFile(file);
    const headers = {
      "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      ...headersFor(servedPath),
      ...headersFor(pathname)
    };
    response.writeHead(200, headers);
    response.end(request.method === "HEAD" ? undefined : body);
    console.log(`200  ${pathname}${servedPath !== pathname ? ` → ${servedPath}` : ""}`);
  } catch (cause) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("500 — erreur du serveur de prévisualisation\n");
    console.error("500 ", pathname, cause);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Prévisualisation Vercel : http://${HOST}:${PORT}`);
  console.log(`Dossier servi : ${OUTPUT}`);
  console.log(`Réécritures : ${REWRITES.length} · règles d'en-têtes : ${HEADERS.length}`);
});
