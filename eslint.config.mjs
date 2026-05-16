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
    // Payload auto-generated migration files — always have unused (payload, req) params
    "src/migrations/**",
    // Payload auto-generated import map
    "src/app/(payload)/admin/importMap.js",
    // Payload auto-generated types
    "payload-types.ts",
  ]),
]);

export default eslintConfig;
