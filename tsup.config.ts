import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  // Minify production builds
  minify: process.env.NODE_ENV === "production",
  // Provide a banner with version info for the ESM build
  esbuildOptions(options) {
    options.banner = {
      js: "/* quorumforge-sdk — MIT License */",
    };
  },
});
