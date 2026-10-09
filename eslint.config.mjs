import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Cerca: o motor, as IAs, as receitas e a execução vista de fora (lib/runs) não podem depender
  // de telas nem do Next.js.
  // Assim a mesma base serve para a web, o conector MCP e o WhatsApp (regra do AGENTS.md).
  {
    files: ["lib/engine/**", "lib/providers/**", "lib/recipes/**", "lib/runs/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app", "@/app/**", "@/components", "@/components/**", "**/app/**", "**/components/**"],
              message: "O motor não pode depender de telas (app/ ou components/).",
            },
            {
              group: ["next", "next/**", "react", "react/**", "react-dom", "react-dom/**"],
              message: "O motor não pode depender do Next.js nem do React.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
