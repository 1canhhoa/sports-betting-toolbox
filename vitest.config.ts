import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["spec/**/*.test.ts"],
    environment: "node",
  },
});
