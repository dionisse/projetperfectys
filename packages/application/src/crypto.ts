/**
 * Empreinte SHA-256 des justificatifs.
 *
 * Le hachage est fait dans le noyau applicatif, pas dans l'adaptateur : ainsi la
 * PWA, l'API et le futur hôte desktop produisent exactement la même empreinte
 * pour le même fichier, et un doublon est détecté quel que soit l'hôte.
 * WebCrypto est disponible dans les navigateurs comme dans Node (>= 18).
 */

import { DomainRuleError } from "@perfecto/domain";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new DomainRuleError(
      "Le calcul de l'empreinte SHA-256 n'est pas disponible dans cet environnement."
    );
  }
  const digest = await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
