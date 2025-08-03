import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config"],
  },
  plugins: [tsConfigPaths()],
});
