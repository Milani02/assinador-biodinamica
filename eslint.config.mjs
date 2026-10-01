import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static assets served as-is (ex.: worker do pdfjs-dist) — nunca são código-fonte nosso.
    "public/**",
  ]),
  {
    rules: {
      // Argumentos exigidos por assinaturas de callback (ex.: `_prevState`,
      // `_formData` do useActionState) e variáveis prefixadas com `_` são
      // marcados como intencionalmente não usados.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
