/**
 * Database client — Neon serverless PostgreSQL + Drizzle ORM
 *
 * We use @neondatabase/serverless instead of the standard pg driver
 * because Next.js API routes run as serverless functions. The standard
 * pg driver keeps a persistent connection pool — that doesn't work when
 * your function can be cold-started at any time.
 *
 * Neon's serverless driver uses HTTP for queries (no persistent TCP connection),
 * which is perfect for Vercel/serverless environments.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Neon connection string."
  );
}

// Create the Neon HTTP client
const sql = neon(process.env.DATABASE_URL);

// Create the Drizzle instance with our schema
// The schema parameter enables type-safe relational queries
export const db = drizzle(sql, { schema });

// Re-export schema types for convenience
export * from "./schema";
