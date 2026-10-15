import { render } from "preact";
import { App } from "./app";
import "./styles/perfecto.css";
import "./styles/app.css";

render(<App />, document.getElementById("app")!);

/** Identifiant de déploiement injecté par Vite (voir vite.config.ts) ; absent en test. */
declare const __PERFECTO_BUILD_ID__: string | undefined;

function serviceWorkerUrl(): string {
  const buildId =
    typeof __PERFECTO_BUILD_ID__ === "string" && __PERFECTO_BUILD_ID__ !== ""
      ? __PERFECTO_BUILD_ID__
      : "dev";
  // La version dans l'URL fait remplacer le service worker à chaque déploiement :
  // un visiteur de retour ne reste jamais sur une coquille périmée.
  return `./sw.js?v=${encodeURIComponent(buildId)}`;
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(serviceWorkerUrl()).catch((cause: unknown) => {
    // L'application s'affiche de toute façon : le mode hors ligne est un confort.
    console.warn("Service worker non enregistré :", cause);
  });
}
