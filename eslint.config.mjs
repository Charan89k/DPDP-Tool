import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  {
    ignores: ["next-env.d.ts", ".next/**", "node_modules/**", ".test-db/**", ".cloude5/**", "storage/**", "docs/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Existing code uses `any` at database row boundaries; flag it without failing the build.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
