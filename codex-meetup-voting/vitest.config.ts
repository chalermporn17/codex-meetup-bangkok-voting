import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: path.join(here, "wrangler.jsonc") },
      miniflare: {
        bindings: {
          ADMIN_PASSWORD: "test-admin-password",
          SESSION_SECRET: "test-session-secret-that-is-long-enough",
          TEST_MIGRATIONS: await readD1Migrations(path.join(here, "migrations"))
        }
      }
    }))
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
    sequence: { concurrent: false }
  }
});
