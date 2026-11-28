import { defineConfig } from "vitest/config";
import path from "node:path";

process.env.AUTH_SECRET ??= "test-auth-secret-not-for-production-32";
process.env.FIELD_ENCRYPTION_KEY ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
process.env.APP_URL ??= "http://localhost:3000";
process.env.BCRYPT_COST ??= "4";
process.env.STORAGE_DRIVER ??= "local";
process.env.STORAGE_LOCAL_DIR ??= "test-private";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/harbourlight";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "playwright-report/**", "test-results/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
