import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  {
    plugins: {
      boundaries,
    },

    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        {
          type: "feature",
          pattern: "src/features/*",
          capture: ["featureName"],
        },
        {
          type: "shared",
          pattern: "src/(components|lib|hooks|config|types)/**",
        },
      ],
    },

    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: "app",
              allow: ["feature", "shared"],
            },
            {
              from: "feature",
              allow: [
                "shared",
                ["feature", { featureName: "${featureName}" }],
              ],
            },
            {
              from: "shared",
              allow: ["shared"],
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;