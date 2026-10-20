import type { Metadata } from "next";
import { OckLogin } from "@/components/OckLogin";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre com o login criado pela sua empresa.",
};

export default function EntrarPage() {
  return <OckLogin />;
}
