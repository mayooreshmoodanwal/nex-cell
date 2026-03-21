import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load env for local development (Vercel handles this automatically in production)
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit commands.");
}

export default {
  schema: "./src/lib/db/schema.ts",
  out:    "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Verbose output for migrations
  verbose: true,
  strict: true,
} satisfies Config;
