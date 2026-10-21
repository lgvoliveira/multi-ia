import type { Metadata } from "next";
import { OwnerDashboard } from "@/components/OwnerDashboard";

export const metadata: Metadata = {
  title: "Painel do dono",
  description: "Gerencie funcionários e acompanhe o gasto de cada um.",
};

export default function DonoPage() {
  return <OwnerDashboard />;
}
