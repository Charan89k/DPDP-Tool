import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = [
  {
    ignores: ["next-env.d.ts", ".next/**", "node_modules/**", ".test-db/**", ".cloude5/**", "storage/**", "docs/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      // Remaining `any` uses are untyped database rows and JSON payloads; tracked as warnings.
      "@typescript-eslint/no-explicit-any": "warn",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
];

export default eslintConfig;
