import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Faz o Vitest entender os atalhos do tsconfig.json, como "@/lib/...".
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Mostra o nome de cada teste, não só o total.
    reporters: ["verbose"],
  },
});
