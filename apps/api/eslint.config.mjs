import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["node_modules", "dist"],
  },
);
