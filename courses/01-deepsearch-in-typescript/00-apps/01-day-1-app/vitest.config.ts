import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config"],
    testTimeout: 60_000,
    sequence: {
      concurrent: false,
    },
  },
  plugins: [tsConfigPaths()],
});
