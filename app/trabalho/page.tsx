import type { Metadata } from "next";
import { OckWorkspace } from "@/components/OckWorkspace";

export const metadata: Metadata = {
  title: "Trabalhar com o time",
  description: "Descreva a tarefa; o Chefe escolhe a melhor IA e mostra o custo.",
};

export default async function TrabalhoPage(props: PageProps<"/trabalho">) {
  const params = await props.searchParams;
  const member = typeof params.member === "string" ? params.member : "";
  return <OckWorkspace memberId={member} />;
}
