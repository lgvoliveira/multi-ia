// O endereço deste site (ex.: http://localhost:3000), para montar links que voltam para cá: o do e-mail de
// confirmação do cadastro e o do convite do funcionário. SÓ do servidor.

import { headers } from "next/headers";

export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
