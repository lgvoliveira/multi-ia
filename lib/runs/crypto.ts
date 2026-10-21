// Guarda as chaves de API do usuário criptografadas em repouso (AES-256-GCM).
// SÓ do servidor: usa a chave secreta RUN_KEY_SECRET, que nunca sai da máquina.
// O blob guardado é base64(iv | texto cifrado | tag), tudo num pedaço só.
// Mexeu num byte do blob (ou na chave)? A verificação da tag quebra e o decryptKeys lança — a chave não vaza.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ProviderKeys } from "@/lib/providers/registry";

const ALGORITHM = "aes-256-gcm";
/** O GCM usa um vetor de 12 bytes (96 bits), o recomendado para este modo. */
const IV_LENGTH = 12;
/** A etiqueta de autenticação do GCM tem 16 bytes (128 bits). */
const TAG_LENGTH = 16;

/** Lê a chave secreta (64 caracteres hex = 32 bytes) do ambiente. Sem ela, criptografar não faz sentido. */
function secretKey(): Buffer {
  const hex = process.env.RUN_KEY_SECRET;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("RUN_KEY_SECRET precisa ser um hex de 32 bytes (64 caracteres).");
  }
  return Buffer.from(hex, "hex");
}

/** Criptografa as chaves (viram JSON) e devolve o blob base64 pronto para guardar. */
export function encryptKeys(keys: ProviderKeys): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(keys), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

/** Desfaz o encryptKeys. Lança se o blob foi adulterado (a tag não bate) ou está malformado. */
export function decryptKeys(blob: string): ProviderKeys {
  const raw = Buffer.from(blob, "base64");
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Blob de chaves malformado.");
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, secretKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as ProviderKeys;
}
