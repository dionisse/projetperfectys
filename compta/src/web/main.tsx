/**
 * Point d'entrée navigateur.
 *
 * Rien d'autre que monter la coquille : la logique vit dans le noyau, les écrans dans `ui/`.
 */

import { render } from "preact";
import { Coquille, Demarrage } from "../ui/coquille";

const cible = document.getElementById("app");
if (!cible) {
  throw new Error("Point de montage #app absent du document.");
}

render(
  <Demarrage>
    <Coquille />
  </Demarrage>,
  cible
);
