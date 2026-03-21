/**
 * DATABASE SEED SCRIPT
 * Run once after migration: npm run db:seed
 *
 * Seeds:
 *  1. Predefined roles (admin + treasurer emails)
 *  2. Default app_config values
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { predefinedRoles, appConfig } from "./schema";
import { sql } from "drizzle-orm";

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Check your .env.local file.");
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log("🌱 Starting seed...\n");

  // ── 1. Predefined Roles ────────────────────────────────────
  // These emails are auto-assigned their role on first login.
  // Change these from the Admin UI after the site is live.

  const predefinedRoleSeeds = [
    // Admin
    {
      email: "ayushsingh1772004@gmail.com",
      role:  "admin" as const,
      note:  "Club Founder — auto-seeded",
    },
    // Treasurer 1 (also admin — multiple roles handled at login)
    {
      email: "ayushkrsingh170708@gmail.com",
      role:  "treasurer" as const,
      note:  "Co-Treasurer — auto-seeded",
    },
  ];

  console.log("📋 Seeding predefined roles...");
  for (const entry of predefinedRoleSeeds) {
    await db
      .insert(predefinedRoles)
      .values(entry)
      .onConflictDoNothing({ target: predefinedRoles.email });
    console.log(`   ✓ ${entry.role.padEnd(12)} → ${entry.email}`);
  }

  // ── 2. App Config ──────────────────────────────────────────
  // These are the default values. All can be changed from the Admin UI.
  // DO NOT hard-code these in application logic — always read from DB.

  const configSeeds = [
    {
      key:         "app_name",
      value:       "NexCell",
      description: "The name of the club platform",
    },
    {
      key:         "app_tagline",
      value:       "Where Founders Are Made",
      description: "Hero tagline shown on the homepage",
    },
    {
      key:         "contact_email",
      value:       "nexcell.mirai@gmail.com",
      description: "Public contact email shown on the site",
    },
    {
      key:         "instagram_handle",
      value:       "nexcell.mirai",
      description: "Instagram handle (without @)",
    },
    {
      key:         "mb_conversion_rate",
      value:       "100",
      description: "How many Mirai Bucks (₥) equal 1 INR. Default: 1 INR = 100 ₥",
    },
    {
      key:         "max_credit_per_request_inr",
      value:       "500",
      description: "Maximum INR a treasurer can approve in a single payment request",
    },
    {
      key:         "require_proof_above_inr",
      value:       "0",
      description: "Screenshot proof required for payments above this INR amount. 0 = always required",
    },
    {
      key:         "require_upi_transaction_id",
      value:       "true",
      description: "Whether UPI transaction ID is mandatory for payment requests",
    },
    {
      key:         "otp_expiry_minutes",
      value:       "5",
      description: "OTP expiry time in minutes",
    },
    {
      key:         "otp_max_attempts",
      value:       "3",
      description: "Maximum incorrect OTP attempts before the code is invalidated",
    },
    {
      key:         "otp_cooldown_seconds",
      value:       "60",
      description: "Seconds a user must wait before requesting another OTP",
    },
    {
      key:         "registration_open",
      value:       "true",
      description: "Master switch — set to false to prevent all new registrations site-wide",
    },
    {
      key:         "maintenance_mode",
      value:       "false",
      description: "When true, shows a maintenance page to all non-admin users",
    },
  ];

  console.log("\n⚙️  Seeding app config...");
  for (const entry of configSeeds) {
    await db
      .insert(appConfig)
      .values(entry)
      .onConflictDoNothing({ target: appConfig.key });
    console.log(`   ✓ ${entry.key.padEnd(35)} = ${entry.value}`);
  }

  console.log("\n✅ Seed complete!\n");
  console.log("Next steps:");
  console.log("  1. Run: npm run dev");
  console.log("  2. Login with ayushsingh1772004@gmail.com — you'll get admin role automatically");
  console.log("  3. Go to /admin to see the admin dashboard\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
