/**
 * Le worker de pdf.js, importé pour son seul effet de bord.
 *
 * `pdfjs-dist` ne publie pas de déclaration de types pour ce module minifié. Il se termine par
 * `globalThis.pdfjsWorker = { WorkerMessageHandler }`, et c'est précisément ce que lit `pdf.mjs` quand
 * il doit analyser un document sans passer par `new Worker(...)` — voir
 * `PDFWorker.#mainThreadWorkerMessageHandler`. Sans cet import, Node réussit et un navigateur échoue.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs" {
  export const WorkerMessageHandler: unknown;
}
